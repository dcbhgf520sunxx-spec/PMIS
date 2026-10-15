const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const integration = process.env.RUN_DB_INTEGRATION === '1'
const schema = `daily_task_test_${crypto.randomBytes(6).toString('hex')}`
if (integration) process.env.DB_OPTIONS = `-c search_path=${schema} -c timezone=Asia/Shanghai`

test('MCP 日常任务可独立查询和创建，BUG仍只接受项目或需求', () => {
  const { getToolDefinition } = require('../src/mcp/catalog')
  const { validateToolArguments } = require('../src/mcp/dispatcher')
  const { decorateQueryResult } = require('../src/mcp/queryTools')
  for (const name of ['task_search', 'task_create', 'task_update']) {
    const definition = getToolDefinition(name, name === 'task_search' ? 'query' : 'action')
    assert.deepEqual(definition.inputSchema.properties.source_type.enum, [1, 2, 3])
    assert.match(definition.inputSchema.properties.source_type.description, /3=日常任务/)
  }
  const body = { mode: 'preview', name: '备份检查', source_type: 3, task_type: 1, owner_ids: [1], expected_end_date: '2026-10-30', idempotency_key: 'daily-task' }
  assert.doesNotThrow(() => validateToolArguments(getToolDefinition('task_create', 'action'), body))
  assert.throws(() => validateToolArguments(getToolDefinition('task_create', 'action'), { ...body, source_type: 1 }), /项目/)
  assert.deepEqual(getToolDefinition('bug_create', 'action').inputSchema.properties.source_type.enum, [1, 2])
  assert.equal(decorateQueryResult('task_get', { source_type: 3 }).source_type_label, '日常任务')
})

test('真实数据库：日常任务新增、复制、关联切换、子任务、历史和产品排除', { skip: !integration }, async () => {
  const db = require('../src/db')
  try {
    await db.pool.query(`CREATE SCHEMA ${schema}`)
    await db.exec(fs.readFileSync(path.join(__dirname, '../db/init/001_schema.sql'), 'utf8').replace(/^ALTER (DATABASE|ROLE).*$/gm, ''))
    const controller = require('../src/controllers/taskController')
    const { invokeController } = require('../src/mcp/controllerAdapter')
    const context = { user: { id: 1, employeeNo: 'admin' }, requestId: 'daily-task-test', ip: '127.0.0.1' }
    const call = (handler, body = {}, params = {}, query = {}) => invokeController(handler, context, { body, params, query })
    const archive = await db.prepare("SELECT a.id FROM pms_archive a JOIN pms_archive_type t ON t.id=a.archive_type_id WHERE t.name='任务类型' AND a.is_deleted=0 LIMIT 1").get()
    const body = { name: '每日备份检查', source_type: 3, task_type: archive.id, owner_ids: [1], expected_end_date: '2026-10-30' }
    const created = await call(controller.create, body)
    assert.equal(created.code, 0, JSON.stringify(created))
    const id = created.data.id
    const get = async id => (await call(controller.getById, {}, { id })).data
    assert.equal((await get(id)).source_type, 3)
    assert.equal((await get(id)).project_id, null)
    assert.equal((await get(id)).requirement_id, null)
    assert.equal((await call(controller.create, { ...body, name: '备份检查副本' })).code, 0)
    assert.notEqual((await call(controller.create, { ...body, name: '缺少来源', source_type: 1 })).code, 0)
    assert.notEqual((await call(controller.create, { ...body, name: '缺少负责人', owner_ids: [] })).code, 0)
    assert.notEqual((await call(controller.create, { ...body, name: '缺少日期', expected_end_date: null })).code, 0)
    const product = (await db.prepare("INSERT INTO pms_product(name,owner_id,status) VALUES('日常任务测试产品',1,1)").run()).lastInsertRowid
    const project = (await db.prepare("INSERT INTO pms_project(name,product_id,owner_id,status,expected_end_date) VALUES('日常任务测试项目',?,1,1,'2026-10-30')").run(product)).lastInsertRowid
    assert.equal((await call(controller.update, { ...body, source_type: 1, project_id: project }, { id })).code, 0)
    assert.equal((await call(controller.update, { ...body, project_id: project }, { id })).code, 0)
    assert.equal((await get(id)).project_id, null)
    const history = (await call(controller.history, {}, { id })).data
    assert.ok(JSON.stringify(history).includes('日常任务'))
    const child = await call(controller.createSubtask, { ...body, name: '子项检查' }, { id })
    assert.equal(child.code, 0)
    assert.equal((await get(child.data.id)).source_type, 3)
    assert.equal((await get(child.data.id)).parent_task_id, id)
    assert.notEqual((await call(controller.update, { ...body, source_type: 1, project_id: project }, { id })).code, 0)
    const list = await call(controller.list, {}, {}, { source_type: 3 })
    assert.equal(list.code, 0)
    assert.ok(list.data.list.some(row => String(row.id) === String(id)))
    assert.ok(!JSON.stringify(await require('../src/services/digitalTwinService').currentSnapshot(1, product)).includes('每日备份检查'))
    const client = (await db.prepare("INSERT INTO pms_mcp_client(name,token_prefix,token_hash,endpoint_type,created_by) VALUES('测试Action','daily',?,'action',1)").run('d'.repeat(64))).lastInsertRowid
    const actionContext = { ...context, client: { id: client }, allowedMenuPaths: new Set(['/tasks']) }
    const { dispatchActionTool } = require('../src/mcp/actionTools')
    const actionArgs = { ...body, name: 'MCP日常任务', mode: 'preview', idempotency_key: 'daily-task-mcp-test' }
    const preview = await dispatchActionTool('task_create', actionArgs, actionContext)
    assert.equal(preview.executed, false)
    assert.equal(preview.preview.displayChanges.source_type, '日常任务')
    const executed = await dispatchActionTool('task_create', preview.executeArguments, actionContext)
    assert.equal(executed.executed, true)
    const saved = await db.prepare('SELECT * FROM pms_task WHERE name=?').get(actionArgs.name)
    assert.equal(saved.source_type, 3)
    assert.equal(saved.project_id, null)
    assert.equal(saved.requirement_id, null)
    await assert.rejects(db.prepare('INSERT INTO pms_task(name,source_type,project_id,task_type) VALUES(?,3,?,?)').run('非法关联', project, archive.id), /check constraint/)
  } finally {
    await db.pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    await db.pool.end()
  }
})
