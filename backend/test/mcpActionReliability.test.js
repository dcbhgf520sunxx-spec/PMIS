const assert = require('node:assert/strict')
const test = require('node:test')
const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js')
const { createMcpServer } = require('../src/mcp/createServer')
const db = require('../src/db')
const { actions, dispatchActionTool, mergeActionUpdateArguments, validateActionBusinessRules } = require('../src/mcp/actionTools')
const { getCommandDefinition } = require('../src/mcp/catalog')
const { validateToolArguments, dispatchMcpTool } = require('../src/mcp/dispatcher')

const context = {
  endpointType: 'action', client: { id: 3 },
  user: { id: 8, employeeNo: 'FIXTURE', realName: '隔离测试' },
  allowedMenuPaths: new Set(['/products', '/projects']), allowedPermissionCodes: new Set(),
}

// Only the pg connection is replaced: the dispatcher, ticket service, controller,
// SQL adapter and transaction/savepoint handling all remain production code.
function productFixture(t, { maintenanceContracts = 0, failLog = false, failTicketMark = false, failCommit = false } = {}) {
  const state = { product: { id: 9, name: '原名称', description: '原说明', owner_id: 8, status: 1 }, tickets: {} }
  const statements = []
  let connectionId = 0
  const query = async (sql, values = [], connection) => {
    statements.push({ sql, connection: connection?.id || 'pool' })
    if (sql === 'BEGIN') { connection.state = structuredClone(state); return { rows: [] } }
    if (sql === 'COMMIT') {
      Object.assign(state, connection.state)
      if (failCommit) throw new Error('isolated lost commit acknowledgement')
      return { rows: [] }
    }
    if (sql === 'ROLLBACK') { connection.state = null; return { rows: [] } }
    if (sql.startsWith('SAVEPOINT ')) {
      connection.savepoints.set(sql.slice(10), structuredClone(connection.state))
      return { rows: [] }
    }
    if (sql.startsWith('ROLLBACK TO SAVEPOINT ')) {
      connection.state = structuredClone(connection.savepoints.get(sql.slice(22)))
      return { rows: [] }
    }
    if (sql.startsWith('RELEASE SAVEPOINT ')) { connection.savepoints.delete(sql.slice(18)); return { rows: [] } }
    const current = connection?.state || state
    if (/INSERT INTO pms_mcp_audit_log/.test(sql)) return { rows: [], rowCount: 1 }
    if (/INSERT INTO pms_mcp_action_ticket/.test(sql)) {
      const [id, client_id, user_id, employee_no, tool_name, arguments_hash, preview, idempotency_key, risk_level, expires_at] = values
      current.tickets[id] = { id, client_id, user_id, employee_no, tool_name, arguments_hash, preview: JSON.parse(preview), idempotency_key, risk_level, expires_at, status: 'pending' }
      return { rows: [], rowCount: 1 }
    }
    if (/SELECT \*\s+FROM pms_mcp_action_ticket/.test(sql)) return { rows: [current.tickets[values[0]]].filter(Boolean) }
    if (/UPDATE pms_mcp_action_ticket/.test(sql)) {
      const row = current.tickets[values.at(-1)]
      if (/SET status = 'failed'/.test(sql)) {
        if (failTicketMark) throw new Error('isolated ticket storage failure')
        if (row?.status === 'executed') row.status = 'failed'
      }
      else if (/status = 'expired'/.test(sql)) row.status = 'expired'
      else if (row?.status === 'pending') row.status = 'executed'
      return { rows: [], rowCount: 1 }
    }
    if (/INSERT INTO pms_op_log/.test(sql)) {
      if (failLog) throw new Error('isolated log failure')
      return { rows: [{ id: 1 }], rowCount: 1 }
    }
    if (/UPDATE pms_product SET name/.test(sql)) {
      Object.assign(current.product, { name: values[0], description: values[1], owner_id: values[2], status: values[3] })
      return { rows: [], rowCount: 1 }
    }
    if (/project_count/.test(sql)) return { rows: [{ project_count: 0, work_order_count: 0, maintenance_contract_count: maintenanceContracts }] }
    if (/FROM pms_product_maintenance_contract/.test(sql)) return { rows: [{ count: maintenanceContracts }] }
    if (/COUNT\(\*\) count FROM pms_project|COUNT\(\*\) count FROM pms_work_order/.test(sql)) return { rows: [{ count: 0 }] }
    if (/FROM pms_user/.test(sql)) return { rows: [{ id: 8, count: 1 }] }
    if (/WHERE name =/.test(sql)) return { rows: [] }
    if (/FROM pms_product/.test(sql)) return { rows: [{ ...current.product }] }
    throw new Error(`Unexpected isolated SQL: ${sql}`)
  }
  t.mock.method(db.pool, 'query', (sql, values) => query(sql, values))
  t.mock.method(db.pool, 'connect', async () => {
    const connection = { id: ++connectionId, state: null, savepoints: new Map(), release() {} }
    connection.query = (sql, values) => query(sql, values, connection)
    return connection
  })
  return { state, statements }
}

function call(name, args) {
  validateToolArguments(getCommandDefinition(name, 'action'), args)
  return dispatchActionTool(name, args, context)
}

test('sparse confirmation keeps only the user supplied edit fields in its reusable payload', async (t) => {
  productFixture(t)
  const preview = await call('product_update', { id: 9, name: '新名称', mode: 'preview' })
  assert.deepEqual(preview.executeArguments, {
    id: 9, name: '新名称', mode: 'execute', confirmation_id: preview.confirmationId,
  })
})

test('sparse execution preserves a concurrent edit to an omitted field', async (t) => {
  const { state, statements } = productFixture(t)
  const preview = await call('product_update', { id: 9, name: '新名称', mode: 'preview' })
  state.product.description = '其他用户的新说明'
  const result = await call('product_update', preview.executeArguments)
  assert.equal(result.executed, true)
  assert.equal(state.product.name, '新名称')
  assert.equal(state.product.description, '其他用户的新说明')
  assert.ok(statements.some(({ sql, connection }) => /FROM pms_product.*FOR UPDATE/s.test(sql) && connection !== 'pool'))
})

test('creator edit uses the complete confirmation chain and retains the actual owner', async (t) => {
  const { state } = productFixture(t)
  Object.assign(state.product, { owner_id: 9, creator_id: 8 })
  const preview = await call('product_update', { id: 9, description: '创建人维护', mode: 'preview' })
  assert.equal(preview.executed, false)
  assert.equal(state.product.description, '原说明')
  const result = await call('product_update', preview.executeArguments)
  assert.equal(result.executed, true)
  assert.equal(state.product.description, '创建人维护')
  assert.equal(state.product.owner_id, 9)
  assert.equal(state.product.creator_id, 8)
  assert.equal(state.tickets[preview.confirmationId].status, 'executed')
  await assert.rejects(call('product_update', preview.executeArguments), { code: 'MCP_CONFIRMATION_ALREADY_USED' })
})

test('creator maintenance permission is rechecked at execution before any business write', async (t) => {
  const { state } = productFixture(t)
  Object.assign(state.product, { owner_id: 9, creator_id: 8 })
  const preview = await call('product_update', { id: 9, description: '创建人维护', mode: 'preview' })
  state.product.creator_id = 10
  await assert.rejects(call('product_update', preview.executeArguments), { code: 'MCP_ACTION_NOT_RESPONSIBLE' })
  assert.equal(state.product.description, '原说明')
  assert.equal(state.tickets[preview.confirmationId].status, 'failed')
})

test('public SDK discovers creator maintenance and completes its confirmed action with permission and schema errors', async (t) => {
  const { state } = productFixture(t)
  Object.assign(state.product, { owner_id: 9, creator_id: 8 })
  const ctx = { ...context, allowedMenuPaths: new Set(context.allowedMenuPaths), allowedPermissionCodes: new Set(['product_update', 'product_delete', 'product_change_status']
    .map((name) => getCommandDefinition(name, 'action')._meta.permissionCode)) }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createMcpServer({ context: ctx, dispatch: dispatchMcpTool })
  const client = new Client({ name: 'creator-permission-test', version: '1.0.0' })
  t.after(async () => { await client.close(); await server.close() })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  const { tools } = await client.listTools()
  const manage = tools.find((tool) => tool.name === 'product_manage')
  assert.match(manage.description, /当前负责人或该单据创建人/)
  const args = { operation: 'update', mode: 'preview', id: 9, description: '协议创建人编辑' }
  const invalid = await client.callTool({ name: 'product_manage', arguments: { ...args, creator_id: 8 } })
  assert.equal(invalid.structuredContent.error.code, 'MCP_ARGUMENT_INVALID')
  const reassignment = await client.callTool({ name: 'product_manage', arguments: { ...args, owner_id: 8 } })
  assert.equal(reassignment.structuredContent.error.code, 'MCP_ACTION_NOT_RESPONSIBLE')
  const preview = await client.callTool({ name: 'product_manage', arguments: args })
  assert.equal(preview.isError, undefined)
  assert.equal(preview.structuredContent.executed, false)
  const payload = preview.structuredContent.execute_payload
  assert.equal(payload.tool_name, 'product_manage')
  assert.equal(state.product.description, '原说明')
  const result = await client.callTool({ name: payload.tool_name, arguments: payload.arguments })
  assert.equal(result.isError, undefined)
  assert.equal(result.structuredContent.executed, true)
  assert.equal(state.product.description, '协议创建人编辑')
  assert.equal(state.product.owner_id, 9)
  ctx.allowedMenuPaths.clear()
  const denied = await client.callTool({ name: 'product_manage', arguments: args })
  assert.equal(denied.structuredContent.error.code, 'MCP_PERMISSION_DENIED')
})

test('sparse execution rejects a concurrent edit to the field the user confirmed', async (t) => {
  const { state } = productFixture(t)
  const preview = await call('product_update', { id: 9, name: '新名称', mode: 'preview' })
  state.product.name = '他人的新名称'
  await assert.rejects(call('product_update', preview.executeArguments), (error) => error.code === 'MCP_DATA_CHANGED')
  assert.equal(state.product.name, '他人的新名称')
  assert.equal(state.tickets[preview.confirmationId].status, 'failed')
})

test('business and history rollback together when a controller returns an error after writing', async (t) => {
  const { state, statements } = productFixture(t, { failLog: true })
  t.mock.method(console, 'error', () => {})
  const preview = await call('product_update', { id: 9, name: '新名称', mode: 'preview' })
  await assert.rejects(call('product_update', preview.executeArguments), (error) => error.code === 'MCP_BUSINESS_ERROR')
  assert.equal(state.product.name, '原名称')
  assert.equal(state.tickets[preview.confirmationId].status, 'failed')
  await assert.rejects(call('product_update', preview.executeArguments), (error) => error.code === 'MCP_CONFIRMATION_ALREADY_USED')
  assert.ok(statements.some(({ sql }) => sql.startsWith('ROLLBACK TO SAVEPOINT ')))
})

test('preview rejects clearing a required editable field without consuming a confirmation', async (t) => {
  const { state } = productFixture(t)
  await assert.rejects(call('product_update', { id: 9, name: null, mode: 'preview' }), (error) => error.code === 'MCP_BUSINESS_VALIDATION')
  assert.deepEqual(state.tickets, {})
})

test('preview rejects deleting a product referenced by a maintenance contract', async (t) => {
  const { state } = productFixture(t, { maintenanceContracts: 1 })
  await assert.rejects(call('product_delete', { id: 9, mode: 'preview' }), (error) => error.code === 'MCP_BUSINESS_VALIDATION')
  assert.deepEqual(state.tickets, {})
})

test('sparse financial edits normalize database NUMERIC and DATE values to the action contract', async () => {
  const { types } = require('pg')
  const money = types.getTypeParser(1700)('100.00')
  const paymentMonth = types.getTypeParser(1082)('2026-08-01')
  const cases = [
    ['payment_update', { project_id: 2, payment_id: 7, remark: '新备注' },
      { payment_amount: money, payment_month: paymentMonth, handler_id: 8, remark: '旧备注' },
      { payment_amount: 100, payment_month: '2026-08', handler_id: 8 }],
    ['contract_update', { project_id: 2, remark: '新备注' },
      { contract_code: 'C-001', contract_name: '合同', supplier_id: 3, signed_date: '2026-08-01', contract_amount: money, remark: '旧备注' },
      { contract_amount: 100 }],
  ]
  for (const [name, args, row, want] of cases) {
    const result = await mergeActionUpdateArguments(name, args, { prepare: () => ({ get: async () => row }) })
    for (const [field, value] of Object.entries(want)) assert.equal(result[field], value, `${name}.${field}`)
  }
})

test('failure to record a failed ticket preserves the business cause and requires outcome verification', async (t) => {
  const { state } = productFixture(t, { failLog: true, failTicketMark: true })
  t.mock.method(console, 'error', () => {})
  const preview = await call('product_update', { id: 9, name: '新名称', mode: 'preview' })
  await assert.rejects(call('product_update', preview.executeArguments), (error) =>
    error.code === 'MCP_EXECUTION_OUTCOME_UNKNOWN' && error.cause?.code === 'MCP_BUSINESS_ERROR')
  assert.equal(state.product.name, '原名称')
})

test('a lost COMMIT acknowledgement never reports definite failure or success', async (t) => {
  const { state } = productFixture(t, { failCommit: true })
  const preview = await call('product_update', { id: 9, name: '新名称', mode: 'preview' })
  await assert.rejects(call('product_update', preview.executeArguments), (error) => error.code === 'MCP_EXECUTION_OUTCOME_UNKNOWN')
  assert.equal(state.product.name, '新名称')
})

test('a failed file handler reports uncertain external effects even when database writes roll back', async (t) => {
  productFixture(t)
  const { OSS_FILE_ORIGIN } = require('../src/services/projectContractOssService')
  t.mock.method(global, 'fetch', async () => new Response('fixture', { headers: { 'content-type': 'text/plain' } }))
  const externalEffects = []
  const dependencies = {
    lockTargets: async () => {},
    validateBusinessRules: async () => {},
    resolvePreviewDisplay: async (_name, args) => ({ project_id: args.project_id, file_name: args.file_name }),
    loadTarget: async () => ({ type: 'contract', id: 2, current: { owner_id: 8 } }),
    actions: { contract_attachment_upload: [async (_req, res) => {
      externalEffects.push('uploaded to external storage')
      res.json({ code: 500, message: '登记附件失败', data: null })
    }, () => ({ body: {} })] },
  }
  const preview = await dispatchActionTool('contract_attachment_upload', {
    project_id: 2, file_name: 'fixture.txt', file_url: `${OSS_FILE_ORIGIN}/fixture`,
    idempotency_key: 'external-fixture', mode: 'preview',
  }, context, dependencies)
  await assert.rejects(dispatchActionTool('contract_attachment_upload', preview.executeArguments, context, dependencies),
    (error) => error.code === 'MCP_EXECUTION_OUTCOME_UNKNOWN')
  assert.equal(externalEffects.length, 1)
})

test('opt-in controller transactions use savepoints and retain the outer transaction after nested rollback', async (t) => {
  const { state, statements } = productFixture(t)
  await db.withTransaction(async () => {
    await db.prepare('UPDATE pms_product SET name = ?, description = ?, owner_id = ?, status = ? WHERE id = ?')
      .run('外层名称', '外层说明', 8, 1, 9)
    await assert.rejects(db.transaction(async (tx) => {
      await tx.prepare('UPDATE pms_product SET name = ?, description = ?, owner_id = ?, status = ? WHERE id = ?')
        .run('内层名称', '内层说明', 8, 1, 9)
      throw new Error('nested failure')
    }), /nested failure/)
    const row = await db.prepare('SELECT * FROM pms_product WHERE id = ?').get(9)
    assert.equal(row.name, '外层名称')
  })
  assert.equal(state.product.name, '外层名称')
  assert.equal(new Set(statements.map(({ connection }) => connection)).size, 1)
  assert.equal(statements.filter(({ sql }) => sql === 'BEGIN').length, 1)
})

test('concurrent opt-in transactions and unscoped queries do not share a connection', async (t) => {
  let nextId = 0
  t.mock.method(db.pool, 'query', async () => ({ rows: [{ connection: 'pool' }] }))
  t.mock.method(db.pool, 'connect', async () => {
    const id = ++nextId
    return { release() {}, query: async () => ({ rows: [{ connection: id }] }) }
  })
  let releaseFirst
  const firstReady = new Promise((resolve) => { releaseFirst = resolve })
  let releaseSecond
  const secondReady = new Promise((resolve) => { releaseSecond = resolve })
  const first = db.withTransaction(async () => {
    const before = await db.prepare('SELECT connection').get()
    releaseFirst()
    await secondReady
    return [before.connection, (await db.prepare('SELECT connection').get()).connection]
  })
  await firstReady
  const second = db.withTransaction(async () => {
    const row = await db.prepare('SELECT connection').get()
    releaseSecond()
    return row.connection
  })
  assert.equal((await db.prepare('SELECT connection').get()).connection, 'pool')
  const [firstIds, secondId] = await Promise.all([first, second])
  assert.deepEqual(firstIds, [1, 1])
  assert.equal(secondId, 2)
})

test('all sparse edit families keep raw confirmation intent and refresh omitted execution fields', async (t) => {
  const cases = [
    ['product_update', { id: 9 }, { name: '产品', description: '旧说明', owner_id: '8' }, 'name', '新产品', 'description', '并发说明'],
    ['project_update', { id: 9 }, { name: '项目', description: '旧说明', product_id: '1', requirement_id: '2', owner_id: '8', start_date: null, expected_end_date: '2026-10-01', progress_text: '旧进度', risk_text: null }, 'risk_text', '新风险', 'progress_text', '并发进度'],
    ['requirement_update', { id: 9 }, { title: '需求', description: '旧说明', requirement_type: 4, product_id: '1', owner_id: '8', submitter_name: '提出人', submitter_dept: null, submit_date: '2026-08-01', start_date: null, expected_end_date: null }, 'title', '新需求', 'description', '并发说明'],
    ['task_update', { id: 9 }, { name: '任务', description: '旧说明', source_type: 1, project_id: '2', requirement_id: null, task_type: '3', start_date: null, expected_end_date: '2026-10-01' }, 'name', '新任务', 'description', '并发说明'],
    ['bug_update', { id: 9 }, { title: 'BUG', description: '旧说明', source_type: 1, project_id: '2', requirement_id: null, bug_type_id: '3', severity: 2, assignee_id: '8' }, 'title', '新BUG', 'description', '并发说明'],
    ['work_order_update', { id: 9 }, { product_id: '1', problem_type: '3', problem_desc: '旧问题', result_desc: '旧结果', follower_id: '8', urgency: 1, expected_resolve_date: '2026-10-01', resolve_date: null, submitter_name: '提出人', submitter_dept: '部门', submit_time: '2026-08-01 08:30:00' }, 'problem_desc', '新问题', 'result_desc', '并发结果'],
    ['stage_update', { project_id: 2, stage_id: 9 }, { name: '阶段', description: '旧说明' }, 'name', '新阶段', 'description', '并发说明'],
    ['stage_item_update', { project_id: 2, item_id: 9 }, { stage_id: '3', name: '事项', owner_id: '8', requires_delivery_file: 0, remark: '旧备注' }, 'name', '新事项', 'remark', '并发备注'],
    ['contract_update', { project_id: 2 }, { id: '9', contract_code: 'C-001', contract_name: '合同', supplier_id: '3', signed_date: '2026-08-01', contract_amount: '100.00', remark: '旧备注' }, 'remark', '新备注', 'contract_name', '并发合同名'],
    ['payment_update', { project_id: 2, payment_id: 9 }, { payment_amount: '100.00', payment_month: '2026-08-01', handler_id: '8', remark: '旧备注' }, 'remark', '新备注', 'payment_month', '2026-07-01', '2026-07'],
  ]
  for (const [name, ids, initial, changedField, changedValue, omittedField, concurrentValue, normalizedValue] of cases) {
    await t.test(name, async (st) => {
      productFixture(st)
      const current = { ...initial }
      const args = { ...ids, [changedField]: changedValue, mode: 'preview' }
      const dependencies = {
        database: { prepare: () => ({
          get: async () => ({ ...current }),
          all: async () => name === 'contract_update'
            ? [{ id: '11', stage_name: '一期', planned_amount: '100.00' }]
            : [{ id: '8' }],
        }) },
        validateBusinessRules: async () => {},
        loadTarget: async () => ({ type: 'project', id: 9, current: { owner_id: 8 } }),
        actions: { [name]: [async (req, res) => res.json({ code: 0, data: req.body }), actions[name][1]] },
      }
      validateToolArguments(getCommandDefinition(name, 'action'), args)
      const preview = await dispatchActionTool(name, args, context, dependencies)
      assert.equal(Object.hasOwn(preview.executeArguments, omittedField), false)
      validateToolArguments(getCommandDefinition(name, 'action'), preview.executeArguments)
      current[omittedField] = concurrentValue
      const result = await dispatchActionTool(name, preview.executeArguments, context, dependencies)
      assert.equal(result.businessResult[changedField], changedValue)
      assert.equal(result.businessResult[omittedField], normalizedValue || concurrentValue)
    })
  }
})

test('required-field clearing is rejected across all edit families before database access', async () => {
  const cases = [
    ['product_update', 'name', null], ['project_update', 'owner_id', null],
    ['requirement_update', 'title', '   '], ['task_update', 'expected_end_date', null],
    ['bug_update', 'title', ''], ['work_order_update', 'follower_id', null],
    ['stage_update', 'name', null], ['stage_item_update', 'owner_id', null],
    ['contract_update', 'contract_name', null], ['payment_update', 'handler_id', null],
    ['follow_up_record_update', 'content', null],
  ]
  const database = { prepare() { throw new Error('invalid field must fail before a database call') } }
  for (const [name, field, value] of cases) {
    await assert.rejects(validateActionBusinessRules(name, { [field]: value }, database),
      (error) => error.code === 'MCP_BUSINESS_VALIDATION' && Object.hasOwn(error.fieldErrors, field), name)
  }
})

test('sparse merged dates cannot create an end-before-start plan', async () => {
  await assert.rejects(validateActionBusinessRules('task_update', {
    start_date: '2026-10-10', expected_end_date: '2026-10-01',
  }, { prepare() { throw new Error('date order must fail before database access') } }),
  (error) => error.code === 'MCP_BUSINESS_VALIDATION' && Object.hasOwn(error.fieldErrors, 'expected_end_date'))
})
