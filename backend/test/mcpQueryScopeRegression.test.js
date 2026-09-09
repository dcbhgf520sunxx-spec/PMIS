const assert = require('node:assert/strict')
const test = require('node:test')
const db = require('../src/db')
const { getToolDefinition } = require('../src/mcp/catalog')
const { validateToolArguments } = require('../src/mcp/dispatcher')
const { dispatchQueryTool } = require('../src/mcp/queryTools')

const context = {
  user: { id: 7 },
  allowedMenuPaths: new Set(['/products', '/projects', '/requirements', '/tasks', '/bugs', '/work-orders']),
}

function captureQueries(t, rows = []) {
  const calls = []
  const previous = db.prepare
  t.after(() => { db.prepare = previous })
  db.prepare = (sql) => ({
    async all(...params) { calls.push({ sql, params, method: 'all' }); return rows },
    async get(...params) { calls.push({ sql, params, method: 'get' }); return { total: rows.length } },
    async run() { throw new Error('查询回归禁止写数据库') },
  })
  return calls
}

test('工单公开跟进人筛选保留到列表与总数SQL，不混入其他跟进人', async (t) => {
  const calls = captureQueries(t)
  await dispatchQueryTool('work_order_search', {
    follower_id: 19, status: 0, expected_resolve_date_from: '2026-09-01', page_size: 100,
  }, context)
  const main = calls.find((call) => call.method === 'all')
  assert.match(main.sql, /w\.follower_id = \?/)
  assert.deepEqual(main.params, [0, 19, '2026-09-01', 100, 0])
  assert.ok(calls.filter((call) => call.method === 'get')
    .some((call) => /w\.follower_id = \?/.test(call.sql) && call.params.includes(19)))
})

test('工单本人视角只使用可信身份并保留状态日期筛选', async (t) => {
  const calls = captureQueries(t)
  await dispatchQueryTool('work_order_search', {
    view: 'mine', status: 0, expected_resolve_date_to: '2026-09-30',
  }, context)
  const main = calls.find((call) => call.method === 'all')
  assert.match(main.sql, /w\.follower_id = \?/)
  assert.deepEqual(main.params, [0, 7, '2026-09-30', 20, 0])
})

test('工单本人视角与显式跟进人取交集，冲突不退回他人清单', async (t) => {
  const calls = captureQueries(t, [{ id: 1, follower_id: 19 }])
  const result = await dispatchQueryTool('work_order_search', {
    view: 'mine', follower_id: 19, page: 3, page_size: 10,
  }, context)
  assert.deepEqual(result.items, [])
  assert.equal(result.total, 0)
  assert.equal(result.page, 3)
  assert.equal(result.pageSize, 10)
  assert.equal(result.hasNextPage, false)
  assert.equal(calls.length, 0)
})

test('本人查询缺少可信身份时拒绝，不能回退到全量查询', async (t) => {
  const calls = captureQueries(t)
  for (const name of ['work_order_search', 'stage_plan_search']) {
    await assert.rejects(() => dispatchQueryTool(name, { view: 'mine' }, { ...context, user: {} }),
      (error) => error.code === 'MCP_PERMISSION_DENIED', name)
  }
  assert.equal(calls.length, 0)
})

test('阶段关键事项本人视角覆盖负责人和明确协作人，并与显式负责人取交集', async (t) => {
  const calls = captureQueries(t)
  await dispatchQueryTool('stage_plan_search', { view: 'mine', owner_id: 19, status: 0 }, context)
  const main = calls.find((call) => call.method === 'all')
  assert.match(main.sql, /i\.owner_id = \? AND \(i\.owner_id = \? OR EXISTS/)
  assert.match(main.sql, /pms_project_plan_item_collaborator/)
  assert.match(main.sql, /c\.plan_item_id = i\.id AND c\.user_id = \?/)
  assert.deepEqual(main.params, [19, 7, 7, 0, 20, 0])
})

test('阶段关键事项逾期筛选排除暂停父项目并固定上海日期', async (t) => {
  const calls = captureQueries(t)
  await dispatchQueryTool('stage_plan_search', { is_overdue: 1 }, context)
  const main = calls.find((call) => call.method === 'all')
  assert.match(main.sql, /p\.status <> 3/)
  assert.match(main.sql, /i\.status IN \(0, 1\)/)
  assert.match(main.sql, /AT TIME ZONE 'Asia\/Shanghai'/)
})

test('阶段查询返回父项目状态和协作证据，不混用事项状态标签', async (t) => {
  const calls = captureQueries(t, [{
    id: 21, item_name: '阶段交付', owner_id: 19, status: 1,
    parent_project_status: 3, collaborators: [{ id: 7, name: '协作员工' }],
  }])
  const result = await dispatchQueryTool('stage_plan_search', {}, context)
  const main = calls.find((call) => call.method === 'all')
  assert.match(main.sql, /p\.status parent_project_status/)
  assert.match(main.sql, /json_agg\(json_build_object\('id',c\.user_id,'name',cu\.real_name\)/)
  assert.equal(result.items[0].parent_project_status_label, '已暂停')
  assert.equal(result.items[0].status_label, '进行中')
  assert.deepEqual(result.items[0].collaborators, [{ id: 7, name: '协作员工' }])
})

test('阶段未逾期筛选使用包含父项目暂停规则的整体反条件', async (t) => {
  const calls = captureQueries(t)
  await dispatchQueryTool('stage_plan_search', { is_overdue: 0 }, context)
  const main = calls.find((call) => call.method === 'all')
  assert.match(main.sql, /NOT \(p\.status <> 3 AND i\.status IN \(0, 1\)/)
})

test('公开查询拒绝伪造本人身份及控制器内部筛选参数', () => {
  for (const name of ['work_order_search', 'stage_plan_search']) {
    for (const field of ['current_user_id', 'filter_follower_id', 'view_key']) {
      assert.throws(() => validateToolArguments(getToolDefinition(name, 'query'), { [field]: field === 'view_key' ? 'mine' : 19 }),
        (error) => error.code === 'MCP_ARGUMENT_INVALID', `${name}.${field}`)
    }
  }
})

test('其他已公开人员状态日期筛选持续进入主查询', async (t) => {
  const cases = [
    ['product_search', { owner_ids: [19], status: 0, created_at_from: '2026-09-01' }, /p\.owner_id IN \(\?\)/, [19, 0, '2026-09-01', 20, 0]],
    ['project_search', { owner_id: 19, status: 0, expected_end_date_from: '2026-09-01' }, /p\.owner_id = \?/, [19, 0, '2026-09-01', 20, 0]],
    ['requirement_search', { owner_id: 19, status: 0, expected_end_date_from: '2026-09-01' }, /r\.owner_id=\?/, [19, 0, '2026-09-01', 20, 0]],
    ['task_search', { owner_id: 19, status: 0, expected_end_date_from: '2026-09-01' }, /task_owner\.user_id=\?/, [0, 19, '2026-09-01', 20, 0]],
    ['bug_search', { assignee_id: 19, status: 0, created_at_from: '2026-09-01' }, /b\.assignee_id=\?/, [0, 19, '2026-09-01', 20, 0]],
  ]
  const calls = captureQueries(t)
  for (const [name, args, ownerSql, expectedParams] of cases) {
    calls.length = 0
    await dispatchQueryTool(name, args, context)
    const main = calls.find((call) => call.method === 'all')
    assert.match(main.sql, ownerSql, name)
    assert.deepEqual(main.params, expectedParams, name)
  }
})
