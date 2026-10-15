const test = require('node:test')
const assert = require('node:assert/strict')
const { createRequirementController } = require('../src/controllers/requirementController')
const { getCommandDefinition } = require('../src/mcp/catalog')
const { validateToolArguments } = require('../src/mcp/dispatcher')
const { parseInput } = require('../src/services/openApiContract')
const { mapItopsRecord } = require('../src/services/itopsSyncRules')

const body = { title: '日期必填需求', requirement_type: 4, product_id: 1, owner_id: 1,
  submitter_name: '测试', submit_date: '2026-10-13' }

test('需求新增和编辑拒绝空预计完成时间，且不写入业务数据或历史', async () => {
  for (const method of ['create', 'update']) {
    for (const date of [undefined, null, '', '   ']) {
      let writes = 0
      const controller = createRequirementController({
        prepare(sql) {
          return {
            get: async () => sql.includes('SELECT *') ? { ...body, status: 31 } : sql.includes('SELECT id FROM pms_requirement') ? undefined : { id: 1 },
            run: async () => { writes++; return { changes: 1, lastInsertRowid: 1 } },
          }
        },
        writeLog: async () => { writes++ }, writeLogs: async () => { writes++ },
      })
      let status, result
      await controller[method]({ body: { ...body, expected_end_date: date }, params: { id: 1 }, user: { id: 1 } }, {
        status(value) { status = value; return this }, json(value) { result = value },
      })
      assert.equal(status, 400, `${method}: ${JSON.stringify(date)}`)
      assert.ok(result.fieldErrors.expected_end_date)
      assert.equal(writes, 0)
    }
  }
})

test('MCP 需求新增契约要求预计完成时间', () => {
  const definition = getCommandDefinition('requirement_create', 'action')
  const args = { ...body, mode: 'preview', idempotency_key: 'required-date-test' }
  for (const date of [undefined, null, '']) {
    assert.throws(() => validateToolArguments(definition, { ...args, expected_end_date: date }), error => {
      assert.ok(error.fieldErrors.expected_end_date)
      return true
    })
  }
  assert.doesNotThrow(() => validateToolArguments(definition, { ...args, expected_end_date: '2026-10-20' }))
})

test('开放接口需求新增要求日期，部分更新禁止清空日期并允许保留原日期', () => {
  const input = { operation: 'CREATE', sourceRecordId: 'required-date-test', operatorEmployeeNo: '001', idempotencyKey: 'required-date-test',
    data: { title: '测试', requirementType: 4, productName: '产品', ownerEmployeeNo: '001', submitterName: '测试', submitDate: '2026-10-13' } }
  for (const date of [undefined, null, '']) {
    assert.throws(() => parseInput('requirement', { ...input, data: { ...input.data, expectedEndDate: date } }), error => {
      assert.ok(error.fieldErrors.expectedEndDate)
      return true
    })
  }
  assert.equal(parseInput('requirement', { ...input, data: { ...input.data, expectedEndDate: '2026-10-20' } }).data.expectedEndDate, '2026-10-20')
  assert.throws(() => parseInput('requirement', { ...input, operation: 'UPDATE', data: { expectedEndDate: null } }))
  assert.equal(parseInput('requirement', { ...input, operation: 'UPDATE', data: { title: '新标题' } }).data.title, '新标题')
})

test('i8 同步需求缺少预计解决时间时拒绝映射，不生成空计划日期', () => {
  const record = { 单据编码: 'I8-DATE-REQUIRED', 单据日期: '2026-10-13', 问题类别: '需求问题', 问题描述: '测试' }
  assert.throws(() => mapItopsRecord(record), /预计解决时间.*为空/)
  assert.equal(mapItopsRecord({ ...record, 预计解决时间: '2026-10-20' }).expectedEndDate, '2026-10-20')
})

test('本地 PostgreSQL 验证需求 MCP 发现、权限、日期校验、确认执行及历史回读', {
  skip: process.env.REQUIREMENT_DATE_DB_TEST !== '1',
}, async () => {
  const db = require('../src/db')
  const crypto = require('node:crypto')
  const { dispatchMcpTool } = require('../src/mcp/dispatcher')
  const { invokeController } = require('../src/mcp/controllerAdapter')
  const { createMcpServer } = require('../src/mcp/createServer')
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
  const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js')
  const rollback = new Error('rollback requirement date fixtures')
  let fixtureId
  try {
    assert.ok(['localhost', '127.0.0.1', '::1'].includes(db.pool.options.host))
    assert.equal(Number(db.pool.options.port), 5433)
    await db.withTransaction(async tx => {
      const user = await tx.prepare("SELECT id,employee_no,real_name FROM pms_user WHERE employee_no='admin' AND status=1 AND is_deleted=0").get()
      const product = await tx.prepare('INSERT INTO pms_product(name,owner_id,status,creator_id,updater_id) VALUES(?,?,1,?,?)')
        .run(`日期验收产品-${crypto.randomUUID()}`, user.id, user.id, user.id)
      const clientRow = await tx.prepare("INSERT INTO pms_mcp_client(name,token_prefix,token_hash,endpoint_type) VALUES('date-test','test',?,'action')")
        .run(crypto.randomBytes(32).toString('hex'))
      const context = { endpointType: 'action', allowedMenuPaths: new Set(['/requirements']), allowedPermissionCodes: new Set(),
        user: { id: Number(user.id), employeeNo: user.employee_no, realName: user.real_name }, client: { id: Number(clientRow.lastInsertRowid) }, ip: '127.0.0.1' }
      const dispatch = (name, args, ctx = context) => dispatchMcpTool(name, args, { ...ctx, auditRequestId: crypto.randomUUID(), requestId: crypto.randomUUID() })
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
      const server = createMcpServer({ context, dispatch })
      const client = new Client({ name: 'requirement-date-test', version: '1' })
      try {
        await server.connect(serverTransport)
        await client.connect(clientTransport)
        assert.ok((await client.listTools()).tools.some(tool => tool.name === 'requirement_manage'))
      } finally { await client.close(); await server.close() }
      const args = { ...body, title: `日期验收需求-${crypto.randomUUID()}`, product_id: Number(product.lastInsertRowid), owner_id: Number(user.id),
        operation: 'create', mode: 'preview', idempotency_key: crypto.randomUUID() }
      await assert.rejects(() => dispatch('requirement_manage', args), error => !!error.fieldErrors?.expected_end_date)
      args.expected_end_date = '2026-10-20'
      await assert.rejects(() => dispatch('requirement_manage', args, { ...context, allowedMenuPaths: new Set() }))
      const preview = await dispatch('requirement_manage', args)
      assert.equal(preview.executed, false)
      const created = await dispatch('requirement_manage', { ...args, mode: 'execute', confirmation_id: preview.confirmationId })
      assert.equal(created.executed, true)
      fixtureId = Number(created.data.id)
      const controller = createRequirementController(tx)
      const read = () => invokeController(controller.getById, context, { params: { id: fixtureId } })
      assert.equal((await read()).data.expected_end_date, '2026-10-20')
      await assert.rejects(() => dispatch('requirement_manage', { operation: 'update', mode: 'preview', id: fixtureId, expected_end_date: null }))
      const edit = { operation: 'update', mode: 'preview', id: fixtureId, expected_end_date: '2026-10-21' }
      const editPreview = await dispatch('requirement_manage', edit)
      await dispatch('requirement_manage', { ...edit, mode: 'execute', confirmation_id: editPreview.confirmationId })
      assert.equal((await read()).data.expected_end_date, '2026-10-21')
      const history = await invokeController(controller.history, context, { params: { id: fixtureId } })
      assert.ok(history.data.some(log => log.changes.some(change => change.field_name === '预计完成时间')))
      await tx.prepare('UPDATE pms_requirement SET expected_end_date=NULL WHERE id=?').run(fixtureId)
      await assert.rejects(() => dispatch('requirement_manage', { operation: 'update', mode: 'preview', id: fixtureId, title: '历史空日期需补齐' }),
        error => !!error.fieldErrors?.expected_end_date)
      throw rollback
    })
  } catch (error) { if (error !== rollback) throw error }
  finally {
    try {
      if (fixtureId) assert.equal((await db.prepare('SELECT COUNT(*) count FROM pms_requirement WHERE id=?').get(fixtureId)).count, '0')
    } finally { await db.pool.end() }
  }
})
