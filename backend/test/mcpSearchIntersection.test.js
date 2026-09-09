const assert = require('node:assert/strict')
const test = require('node:test')
const { Client } = require('pg')

const db = require('../src/db')
const { toPostgresSql } = require('../src/dbSql')
const requirementController = require('../src/controllers/requirementController')
const taskController = require('../src/controllers/taskController')
const bugController = require('../src/controllers/bugController')
const { getToolDefinition } = require('../src/mcp/catalog')
const { invokeController } = require('../src/mcp/controllerAdapter')
const { validateToolArguments } = require('../src/mcp/dispatcher')
const { dispatchQueryTool } = require('../src/mcp/queryTools')

const context = {
  user: { id: 7 },
  allowedMenuPaths: new Set(['/projects', '/requirements', '/tasks', '/bugs']),
}

function captureQueries(t, rows = []) {
  const calls = []
  const previous = db.prepare
  t.after(() => { db.prepare = previous })
  db.prepare = (sql) => ({
    async all(...params) { calls.push({ sql, params, method: 'all' }); return rows },
    async get(...params) { calls.push({ sql, params, method: 'get' }); return { total: rows.length } },
    async run() { throw new Error('组合查询测试禁止写数据库') },
  })
  return calls
}

test('项目本人视角与其他负责人筛选取交集且直接返回空集', async (t) => {
  const calls = captureQueries(t, [{ id: 91, owner_id: 19 }])
  const result = await dispatchQueryTool('project_search', {
    view: 'mine', owner_id: 19, page: 2, page_size: 10,
  }, context)

  assert.deepEqual(result.items, [])
  assert.equal(result.total, 0)
  assert.equal(result.page, 2)
  assert.equal(result.pageSize, 10)
  assert.equal(calls.length, 0)
})

test('需求和BUG的本人视角与显式人员筛选独立进入SQL', async (t) => {
  const calls = captureQueries(t)

  await dispatchQueryTool('requirement_search', { view: 'mine', owner_id: 19 }, context)
  let main = calls.find((call) => call.method === 'all')
  assert.match(main.sql, /r\.owner_id=\?[\s\S]*r\.owner_id=\?/)
  assert.deepEqual(main.params.slice(0, 2), [7, 19])

  calls.length = 0
  await dispatchQueryTool('bug_search', { view: 'mine', assignee_id: 19 }, context)
  main = calls.find((call) => call.method === 'all')
  assert.match(main.sql, /b\.assignee_id=\?[\s\S]*b\.assignee_id=\?/)
  assert.deepEqual(main.params.slice(0, 2), [7, 19])
})

test('本人视角忽略null显式人员而不把null转成用户0', async (t) => {
  const calls = captureQueries(t)
  const cases = [
    ['requirement_search', { view: 'mine', owner_id: null }, /r\.owner_id=\?/],
    ['task_search', { view: 'mine', owner_id: null }, /EXISTS \(SELECT 1 FROM pms_task_owner task_owner/],
    ['bug_search', { view: 'mine', assignee_id: null }, /b\.assignee_id=\?/],
  ]

  for (const [name, args, mineCondition] of cases) {
    calls.length = 0
    await dispatchQueryTool(name, args, context)
    const main = calls.find((call) => call.method === 'all')
    assert.match(main.sql, mineCondition, name)
    assert.deepEqual(main.params.slice(0, -2), [7], name)
  }
})

test('普通HTTP本人视角也把null内部人员筛选视为空筛选', async (t) => {
  const calls = captureQueries(t)
  const cases = [
    [requirementController.list, 'filter_owner_id', /r\.owner_id=\?/],
    [taskController.list, 'filter_owner_id', /EXISTS \(SELECT 1 FROM pms_task_owner task_owner/],
    [bugController.list, 'filter_assignee_id', /b\.assignee_id=\?/],
  ]

  for (const [handler, field, mineCondition] of cases) {
    calls.length = 0
    await invokeController(handler, context, { query: { view: 'mine', [field]: null, mcp_flat: '1' } })
    const main = calls.find((call) => call.method === 'all')
    assert.match(main.sql, mineCondition, field)
    assert.deepEqual(main.params.slice(0, -2), [7], field)
  }
})

test('多负责人任务用两个独立EXISTS求本人与指定人员交集', async (t) => {
  const calls = captureQueries(t, [{ id: 71, name: '同属7和19', owners: [{ id: 7 }, { id: 19 }], total: 1 }])
  const result = await dispatchQueryTool('task_search', {
    view: 'mine', owner_id: 19,
  }, context)

  const main = calls.find((call) => call.method === 'all')
  assert.match(main.sql, /EXISTS \(SELECT 1 FROM pms_task_owner task_owner[\s\S]*EXISTS \(SELECT 1 FROM pms_task_owner filtered_task_owner/)
  assert.deepEqual(main.params.slice(0, 2), [7, 19])
  assert.deepEqual(result.items.map((item) => item.id), [71])
})

test('阶段、合同和付款的自定义排序用各自真实主键稳定兜底', async (t) => {
  const calls = captureQueries(t)
  const cases = [
    ['stage_plan_search', { sort_field: 'project_name', sort_order: 'asc' }, /ORDER BY p\.name ASC, i\.id ASC LIMIT/],
    ['contract_search', { sort_field: 'contract_name', sort_order: 'desc' }, /ORDER BY c\.contract_name DESC, c\.id DESC LIMIT/],
    ['payment_search', { sort_field: 'stage_name', sort_order: 'asc' }, /ORDER BY s\.stage_name ASC, r\.id ASC LIMIT/],
  ]

  for (const [name, args, expectedOrder] of cases) {
    calls.length = 0
    await dispatchQueryTool(name, args, context)
    const main = calls.find((call) => call.method === 'all')
    assert.match(main.sql, expectedOrder, name)
  }
})

test('阶段、合同和付款的默认排序保持现有业务顺序', async (t) => {
  const calls = captureQueries(t)
  const cases = [
    ['stage_plan_search', /ORDER BY p\.name ASC, s\.sort_order ASC, i\.sort_order ASC, i\.id ASC LIMIT/],
    ['contract_search', /ORDER BY c\.signed_date DESC, c\.id DESC LIMIT/],
    ['payment_search', /ORDER BY r\.payment_month DESC, r\.id DESC LIMIT/],
  ]

  for (const [name, expectedOrder] of cases) {
    calls.length = 0
    await dispatchQueryTool(name, {}, context)
    const main = calls.find((call) => call.method === 'all')
    assert.match(main.sql, expectedOrder, name)
  }
})

test('项目、需求、任务和BUG本人查询缺少可信身份时不读数据', async (t) => {
  const calls = captureQueries(t)
  for (const name of ['project_search', 'requirement_search', 'task_search', 'bug_search']) {
    await assert.rejects(
      () => dispatchQueryTool(name, { view: 'mine' }, { ...context, user: {} }),
      (error) => error.code === 'MCP_PERMISSION_DENIED',
      name
    )
  }
  assert.equal(calls.length, 0)
})

test('公开Schema不暴露交集查询的控制器内部参数', () => {
  const fields = ['current_user_id', 'filter_owner_id', 'filter_assignee_id', 'view_key']
  for (const name of ['project_search', 'requirement_search', 'task_search', 'bug_search']) {
    for (const field of fields) {
      assert.throws(
        () => validateToolArguments(getToolDefinition(name, 'query'), { [field]: field === 'view_key' ? 'mine' : 19 }),
        (error) => error.code === 'MCP_ARGUMENT_INVALID',
        `${name}.${field}`
      )
    }
  }
})

// 可选本地 PostgreSQL 验收只使用 READ ONLY 事务和 CTE 隔离数据，
// 不读取、不写入现有业务单据。
test('真实PostgreSQL执行隔离CTE验证单负责人冲突与多负责人交集', {
  skip: process.env.SIDM_MCP_SEARCH_PG !== '1' && 'set SIDM_MCP_SEARCH_PG=1 for local read-only PostgreSQL acceptance',
}, async (t) => {
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(db.pool.options.host))
  assert.equal(Number(db.pool.options.port), 5433)
  const connection = new Client(db.pool.options)
  await connection.connect()
  t.after(async () => { await connection.query('ROLLBACK'); await connection.end() })
  await connection.query('BEGIN READ ONLY')
  await connection.query("SET LOCAL statement_timeout = '5s'")

  const fixtures = {
    pms_user: [7, 19].map((id) => ({ id, real_name: `隔离人员${id}`, status: 1, is_deleted: 0 })),
    pms_product: [{ id: 11, name: '隔离产品', owner_id: 7, status: 1, is_deleted: 0 }],
    pms_requirement: [
      { id: 101, title: '本人需求', product_id: 11, owner_id: 7, requirement_type: 1, priority: 1, status: 0, is_deleted: 0 },
      { id: 102, title: '他人需求', product_id: 11, owner_id: 19, requirement_type: 1, priority: 1, status: 0, is_deleted: 0 },
    ],
    pms_project: [{ id: 111, name: '本人项目', product_id: 11, requirement_id: 101, owner_id: 7, priority: 1, status: 0, is_deleted: 0 }],
    pms_project_member: [],
    pms_archive: [
      { id: 121, name: '任务类型', status: 1, is_deleted: 0 },
      { id: 122, name: 'BUG类型', status: 1, is_deleted: 0 },
      { id: 123, name: '供应商', status: 1, is_deleted: 0 },
    ],
    pms_task: [
      { id: 201, name: '同属7和19', source_type: 1, project_id: 111, task_type: 121, priority: 1, status: 0, is_deleted: 0 },
      { id: 202, name: '仅属7', source_type: 1, project_id: 111, task_type: 121, priority: 1, status: 0, is_deleted: 0 },
    ],
    pms_task_owner: [
      { task_id: 201, user_id: 7, sort_order: 0 },
      { task_id: 201, user_id: 19, sort_order: 1 },
      { task_id: 202, user_id: 7, sort_order: 0 },
    ],
    pms_bug: [
      { id: 301, title: '本人BUG', source_type: 1, project_id: 111, bug_type_id: 122, severity: 1, status: 0, assignee_id: 7, is_deleted: 0 },
      { id: 302, title: '他人BUG', source_type: 1, project_id: 111, bug_type_id: 122, severity: 1, status: 0, assignee_id: 19, is_deleted: 0 },
    ],
    pms_project_plan_stage: [{ id: 501, project_id: 111, name: '同名阶段', sort_order: 0, is_deleted: 0 }],
    pms_project_plan_item: [601, 602].map((id) => ({
      id, stage_id: 501, name: '同名事项', owner_id: 7, status: 0, sort_order: 0,
      original_due_date: '2026-09-30', current_due_date: '2026-09-30', requires_delivery_file: 0, is_deleted: 0,
    })),
    pms_project_plan_item_collaborator: [],
    pms_project_contract: [701, 702].map((id) => ({
      id, project_id: 111, contract_code: `C-${id}`, contract_name: '同名合同', supplier_id: 123,
      signed_date: '2026-09-01', contract_amount: 100, is_deleted: 0,
    })),
    pms_project_payment_stage: [801, 802].map((id, index) => ({
      id, contract_id: 701, stage_name: '同名付款阶段', sort_order: index, is_deleted: 0,
    })),
    pms_project_payment_record: [901, 902].map((id, index) => ({
      id, stage_id: 801 + index, payment_amount: 10, payment_month: '2026-09-01', handler_id: 7, is_deleted: 0,
    })),
    pms_op_log: [],
  }
  const prefix = `WITH ${Object.entries(fixtures).map(([table, rows]) =>
    `${table} AS (SELECT * FROM jsonb_populate_recordset(NULL::public.${table}, '${JSON.stringify(rows)}'::jsonb))`
  ).join(', ')} `
  const previous = db.prepare
  t.after(() => { db.prepare = previous })
  let reads = 0
  db.prepare = (sql) => {
    assert.match(sql.trimStart(), /^SELECT\b/i)
    for (const table of sql.match(/\bpms_\w+\b/g) || []) assert.ok(Object.hasOwn(fixtures, table), table)
    const query = async (params) => {
      reads += 1
      return connection.query(prefix + toPostgresSql(sql), params)
    }
    return {
      all: async (...params) => (await query(params)).rows,
      get: async (...params) => (await query(params)).rows[0],
      run: async () => { throw new Error('只读CTE验收禁止写数据库') },
    }
  }

  const requirement = await dispatchQueryTool('requirement_search', { view: 'mine', owner_id: 19 }, context)
  const bug = await dispatchQueryTool('bug_search', { view: 'mine', assignee_id: 19 }, context)
  const task = await dispatchQueryTool('task_search', { view: 'mine', owner_id: 19 }, context)
  assert.equal(requirement.total, 0)
  assert.equal(bug.total, 0)
  assert.deepEqual(task.items.map((item) => Number(item.id)), [201])
  assert.ok(task.items[0].owners.some((owner) => Number(owner.id) === 7))
  assert.ok(task.items[0].owners.some((owner) => Number(owner.id) === 19))

  const stagePlan = await dispatchQueryTool('stage_plan_search', { sort_field: 'project_name', sort_order: 'asc' }, context)
  const contract = await dispatchQueryTool('contract_search', { sort_field: 'contract_name', sort_order: 'desc' }, context)
  const payment = await dispatchQueryTool('payment_search', { sort_field: 'stage_name', sort_order: 'asc' }, context)
  assert.deepEqual(stagePlan.items.map((item) => Number(item.id)), [601, 602])
  assert.deepEqual(contract.items.map((item) => Number(item.id)), [702, 701])
  assert.deepEqual(payment.items.map((item) => Number(item.id)), [901, 902])
  assert.ok(reads > 0)
  t.diagnostic(`PostgreSQL read-only CTE statements evaluated: ${reads}; persistent writes: 0`)
})
