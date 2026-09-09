const assert = require('node:assert/strict')
const test = require('node:test')
const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js')
const { AjvJsonSchemaValidator } = require('@modelcontextprotocol/sdk/validation/ajv')
const db = require('../src/db')
const { toPostgresSql } = require('../src/dbSql')
const { createMcpServer } = require('../src/mcp/createServer')
const { dispatchMcpTool } = require('../src/mcp/dispatcher')

const baseArgs = {
  analysis_period: { preset: 'custom', start_date: '2026-09-01', end_date: '2026-09-07' },
  business_types: ['task'],
}
const stockQuery = { source: 'stock', metric: 'total', page_size: 1 }
const validator = new AjvJsonSchemaValidator()

function context(menuPaths = ['/tasks']) {
  return {
    endpointType: 'query', user: { id: 8, employeeNo: 'PROTOCOL-FIXTURE' },
    client: { id: 9001 }, auditRequestId: 'reliability-protocol-fixture',
    allowedMenuPaths: new Set(menuPaths), allowedPermissionCodes: new Set(),
  }
}

async function connectProtocol(t, ctx = context()) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createMcpServer({ context: ctx, dispatch: dispatchMcpTool })
  const client = new Client({ name: 'reliability-protocol-test', version: '1.0.0' })
  t.after(async () => { await client.close(); await server.close() })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  const { tools } = await client.listTools()
  const outputValidators = new Map(tools.map(tool => [tool.name, validator.getValidator(tool.outputSchema)]))
  return {
    tools,
    async call(name, args) {
      const result = await client.callTool({ name, arguments: args })
      if (!result.isError) {
        const validation = outputValidators.get(name)(result.structuredContent)
        assert.equal(validation.valid, true, validation.errorMessage)
      }
      return result
    },
  }
}

function assertError(result, code, field) {
  assert.equal(result.isError, true)
  assert.equal(result.structuredContent.error.code, code)
  assert.equal(result.structuredContent.error.requestId, 'reliability-protocol-fixture')
  if (field) assert.equal(typeof result.structuredContent.error.fieldErrors[field], 'string')
  assert.equal(result.structuredContent.details, undefined)
}

function periodRow(id, ownerId = 8) {
  return {
    business_type: 'task', id, name: `隔离事项${id}`, status: 1, priority: 1,
    product_id: null, project_id: null, requirement_id: null, parent_task_id: null,
    owner_id: ownerId, owner_name: `隔离人员${ownerId}`, owner_ids: [ownerId],
    business_role_ids: [ownerId], person_ids: [ownerId], creator_id: ownerId, updater_id: ownerId,
    plan_date: '2026-09-05', actual_date: null, pause_date: null, created_at: '2026-09-01 09:00:00+08',
    is_completed: false, is_paused: false, is_overdue: 0, parent_project_paused: false,
    required_delivery: false, delivery_count: 0,
  }
}

function installPeriodFixture(t) {
  const state = { rows: [periodRow(1), periodRow(2), periodRow(3, 9)], reads: 0, audits: 0 }
  const originalPrepare = db.prepare
  t.after(() => { db.prepare = originalPrepare })
  db.prepare = (sql) => {
    if (/INSERT INTO pms_mcp_audit_log/.test(sql)) {
      return { run: async () => { state.audits += 1; return { changes: 1 } } }
    }
    if (/period_analysis:records:task/.test(sql)) {
      return { all: async () => { state.reads += 1; return structuredClone(state.rows) } }
    }
    if (/period_analysis:logs/.test(sql)) return { all: async () => [] }
    if (/period_analysis:(people|report_people)/.test(sql)) {
      return { all: async (...ids) => [8, 9].filter(id => ids.flat().map(Number).includes(id))
        .map(id => ({ id, name: `隔离人员${id}`, status: 1, is_deleted: 0 })) }
    }
    throw new Error('协议测试遇到未隔离的数据库调用')
  }
  return state
}

test('real SDK Query protocol exercises period scope, paging, errors and public output schemas', async (t) => {
  const state = installPeriodFixture(t)
  const protocol = await connectProtocol(t)

  await t.test('discovery advertises self and continuation tokens without internal identity controls', () => {
    const tool = protocol.tools.find(item => item.name === 'business_period_analysis')
    assert.ok(tool.inputSchema.properties.filters.properties.person_scope)
    assert.ok(tool.inputSchema.properties.detail_query.properties.dataset_token)
    assert.equal(tool.inputSchema.properties.current_user_id, undefined)
  })

  await t.test('self actually excludes other-owned records and all detail sources satisfy the public schema', async () => {
    const all = await protocol.call('business_period_analysis', baseArgs)
    assert.equal(all.isError, undefined)
    assert.equal(all.structuredContent.current_stock.total.total, 3)
    const ownArgs = { ...baseArgs, filters: { person_scope: 'self', person_relation: 'business_role' } }
    const own = await protocol.call('business_period_analysis', ownArgs)
    assert.equal(own.structuredContent.current_stock.total.total, 2)
    for (const detail_query of [
      { source: 'stock', metric: 'total' }, { source: 'flow', metric: 'created' },
      { source: 'plan', metric: 'pending' }, { source: 'risk', metric: 'missing_plan_date' },
      { source: 'people' },
    ]) {
      const result = await protocol.call('business_period_analysis', {
        ...ownArgs, plan_period: baseArgs.analysis_period, detail_query,
      })
      assert.equal(result.isError, undefined)
      if (['stock', 'flow', 'plan'].includes(detail_query.source)) {
        assert.deepEqual(result.structuredContent.details.items.map(item => item.target_id), [1, 2])
        assert.equal(result.structuredContent.details.total, 2)
      }
      if (detail_query.source === 'people') {
        assert.deepEqual(result.structuredContent.details.items.map(item => item.user_id), [8])
      }
    }
  })

  await t.test('same dataset returns all three pages exactly once with the original token', async () => {
    const first = await protocol.call('business_period_analysis', { ...baseArgs, detail_query: stockQuery })
    const token = first.structuredContent.details.datasetToken
    assert.match(token, /^[a-f0-9]{64}$/)
    const ids = first.structuredContent.details.items.map(item => item.target_id)
    for (const page of [2, 3]) {
      const next = await protocol.call('business_period_analysis', {
        ...baseArgs, detail_query: { ...stockQuery, page, dataset_token: token },
      })
      assert.equal(next.isError, undefined)
      assert.equal(next.structuredContent.details.total, 3)
      assert.equal(next.structuredContent.details.hasNextPage, page !== 3)
      ids.push(...next.structuredContent.details.items.map(item => item.target_id))
    }
    assert.deepEqual(ids, [1, 2, 3])
  })

  await t.test('changing content without changing total refuses continuation and permits a fresh first page', async () => {
    const first = await protocol.call('business_period_analysis', { ...baseArgs, detail_query: stockQuery })
    state.rows[1] = periodRow(4)
    const stale = await protocol.call('business_period_analysis', {
      ...baseArgs, detail_query: { ...stockQuery, page: 2, dataset_token: first.structuredContent.details.datasetToken },
    })
    assertError(stale, 'MCP_DATA_CHANGED', 'detail_query.dataset_token')
    const fresh = await protocol.call('business_period_analysis', { ...baseArgs, detail_query: stockQuery })
    assert.equal(fresh.structuredContent.details.total, 3)
    assert.notEqual(fresh.structuredContent.details.datasetToken, first.structuredContent.details.datasetToken)
    state.rows[1] = periodRow(2)
  })

  await t.test('changing page size with an old token is rejected so offset pagination cannot skip rows', async () => {
    const first = await protocol.call('business_period_analysis', { ...baseArgs, detail_query: stockQuery })
    const changed = await protocol.call('business_period_analysis', {
      ...baseArgs, detail_query: { ...stockQuery, page: 2, page_size: 2, dataset_token: first.structuredContent.details.datasetToken },
    })
    assertError(changed, 'MCP_DATA_CHANGED', 'detail_query.dataset_token')
  })

  await t.test('missing continuation token and self plus explicit IDs return stable field errors', async () => {
    const missing = await protocol.call('business_period_analysis', {
      ...baseArgs, detail_query: { ...stockQuery, page: 2 },
    })
    assertError(missing, 'MCP_ARGUMENT_INVALID', 'detail_query.dataset_token')
    for (const person_ids of [[], [9]]) {
      const conflict = await protocol.call('business_period_analysis', {
        ...baseArgs, filters: { person_scope: 'self', person_ids },
      })
      assertError(conflict, 'MCP_ARGUMENT_INVALID')
    }
  })

  await t.test('no menu means hidden tool and MCP_PERMISSION_DENIED without a business read', async (child) => {
    const deniedProtocol = await connectProtocol(child, context([]))
    assert.equal(deniedProtocol.tools.some(tool => tool.name === 'business_period_analysis'), false)
    const before = state.reads
    const denied = await deniedProtocol.call('business_period_analysis', baseArgs)
    assertError(denied, 'MCP_PERMISSION_DENIED')
    assert.equal(state.reads, before)
  })
  await t.test('self without an authenticated user ID is refused instead of becoming an all-users query', async (child) => {
    const noIdentityContext = { ...context(), user: {} }
    const noIdentityProtocol = await connectProtocol(child, noIdentityContext)
    const before = state.reads
    const result = await noIdentityProtocol.call('business_period_analysis', {
      ...baseArgs, filters: { person_scope: 'self' },
    })
    assertError(result, 'MCP_PERMISSION_DENIED')
    assert.equal(state.reads, before)
  })
  assert.ok(state.audits > 0)
})

// Optional PostgreSQL acceptance uses only SELECT CTEs in BEGIN READ ONLY.
// JSON rows shadow all business table references; no real business rows are read or written.
test('real SDK query scope with actual PostgreSQL evaluation of isolated CTE rows', {
  skip: process.env.SIDM_MCP_PROTOCOL_PG !== '1' && 'set SIDM_MCP_PROTOCOL_PG=1 for local read-only PostgreSQL acceptance',
}, async (t) => {
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(db.pool.options.host))
  assert.equal(Number(db.pool.options.port), 5433)
  const connection = await db.pool.connect()
  t.after(async () => { await connection.query('ROLLBACK'); connection.release(); await db.pool.end() })
  await connection.query('BEGIN READ ONLY')
  await connection.query("SET LOCAL statement_timeout = '5s'")
  const fixtures = {
    pms_user: [8, 9].map(id => ({ id, real_name: `隔离人员${id}`, status: 1, is_deleted: 0 })),
    pms_product: [{ id: 11, name: '隔离产品', status: 1, is_deleted: 0 }],
    pms_archive: [],
    pms_work_order: [8, 9, 8].map((follower_id, index) => ({
      id: index + 1, product_id: 11, problem_desc: `隔离工单${index}`, follower_id,
      status: 0, urgency: 1, is_deleted: 0, is_overdue: 0, creator_id: 9, updater_id: 9,
      expected_resolve_date: '2000-01-02 12:00:00', created_at: '2000-01-01 12:00:00',
    })),
    pms_project: [1, 3].map((status, index) => ({ id: 21 + index, name: `隔离项目${index}`, status, is_deleted: 0 })),
    pms_project_plan_stage: [21, 22].map((project_id, index) => ({ id: 31 + index, project_id, name: `隔离阶段${index}`, is_deleted: 0, sort_order: 1 })),
    pms_project_plan_item: [8, 9, 9, 8].map((owner_id, index) => ({
      id: index + 1, stage_id: index === 3 ? 32 : 31, owner_id, name: `隔离事项${index}`,
      status: 1, is_deleted: 0, sort_order: index, current_due_date: '2000-01-02',
      original_due_date: '2000-01-02', requires_delivery_file: 0,
    })),
    pms_project_plan_item_collaborator: [{ plan_item_id: 2, user_id: 8, sort_order: 1 }],
  }
  const prefix = `WITH ${Object.entries(fixtures).map(([table, rows]) =>
    `${table} AS (SELECT * FROM jsonb_populate_recordset(NULL::public.${table}, '${JSON.stringify(rows)}'::jsonb))`
  ).join(', ')} `
  let sqlReads = 0
  const originalPrepare = db.prepare
  t.after(() => { db.prepare = originalPrepare })
  db.prepare = sql => {
    if (/INSERT INTO pms_mcp_audit_log/.test(sql)) return { run: async () => ({ changes: 1 }) }
    assert.match(sql.trimStart(), /^SELECT\b/i)
    for (const table of sql.match(/\bpms_\w+\b/g) || []) assert.ok(Object.hasOwn(fixtures, table))
    const query = async params => {
      sqlReads += 1
      return connection.query(prefix + toPostgresSql(sql), params)
    }
    return {
      all: async (...params) => (await query(params)).rows,
      get: async (...params) => (await query(params)).rows[0],
      run: async () => { throw new Error('只读协议验收禁止数据库写入') },
    }
  }
  const protocol = await connectProtocol(t, context(['/work-orders', '/projects']))

  await t.test('work-order mine and explicit follower filters select the actual intersection', async () => {
    const all = await protocol.call('work_order_search', {})
    assert.equal(all.structuredContent.total, 3)
    const own = await protocol.call('work_order_search', { view: 'mine' })
    assert.equal(own.structuredContent.total, 2)
    assert.ok(own.structuredContent.items.every(item => Number(item.follower_id) === 8))
    const other = await protocol.call('work_order_search', { follower_id: 9 })
    assert.equal(other.structuredContent.total, 1)
    assert.equal(Number(other.structuredContent.items[0].follower_id), 9)
    const empty = await protocol.call('work_order_search', { view: 'mine', follower_id: 9 })
    assert.equal(empty.structuredContent.total, 0)
  })

  await t.test('stage mine includes owner and collaborator, excludes unrelated and paused-project overdue', async () => {
    const own = await protocol.call('stage_plan_search', { view: 'mine' })
    assert.deepEqual(own.structuredContent.items.map(item => Number(item.id)).sort(), [1, 2, 4])
    const collab = own.structuredContent.items.find(item => Number(item.id) === 2)
    assert.equal(Number(collab.owner_id), 9)
    assert.ok(collab.collaborators.some(person => Number(person.id) === 8))
    const overdue = await protocol.call('stage_plan_search', { view: 'mine', is_overdue: 1 })
    assert.deepEqual(overdue.structuredContent.items.map(item => Number(item.id)).sort(), [1, 2])
    const intersection = await protocol.call('stage_plan_search', { view: 'mine', owner_id: 9 })
    assert.deepEqual(intersection.structuredContent.items.map(item => Number(item.id)), [2])
    const notOverdue = await protocol.call('stage_plan_search', { view: 'mine', is_overdue: 0 })
    assert.deepEqual(notOverdue.structuredContent.items.map(item => Number(item.id)), [4])
    assert.equal(notOverdue.structuredContent.items[0].parent_project_status_label, '已暂停')
  })
  await t.test('known search tools reject model-supplied internal identity controls through SDK errors', async () => {
    const before = sqlReads
    for (const name of ['work_order_search', 'stage_plan_search']) {
      const result = await protocol.call(name, { view: 'mine', current_user_id: 9 })
      assertError(result, 'MCP_ARGUMENT_INVALID', 'current_user_id')
    }
    assert.equal(sqlReads, before)
  })
  assert.ok(sqlReads > 0)
  t.diagnostic(`PostgreSQL read-only CTE statements evaluated: ${sqlReads}; persistent writes: 0`)
})
