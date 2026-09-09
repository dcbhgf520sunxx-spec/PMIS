const assert = require('node:assert/strict')
const test = require('node:test')
const { dispatchQueryTool } = require('../src/mcp/queryTools')

const now = new Date('2026-09-08T02:00:00Z')
const base = {
  analysis_period: { preset: 'custom', start_date: '2026-09-01', end_date: '2026-09-08' },
  business_types: ['work_order'],
}
const context = { allowedMenuPaths: new Set(['/work-orders']) }

function fixture(count = 120) {
  const rows = Array.from({ length: count }, (_, i) => ({
    business_type: 'work_order', id: i + 1, name: `<p>工单 ${i + 1}</p><img src="https://oss.example/private?signature=secret">`,
    status: 1, priority: 1, owner_id: 1, owner_ids: [1], owner_name: '负责人',
    business_role_ids: [1], person_ids: [1, 4], creator_id: 4, updater_id: 2,
    plan_date: '2026-09-06', actual_date: null, created_at: '2026-09-01 10:00:00+08',
    is_completed: false, is_paused: false, is_overdue: 1,
  }))
  const logs = [{
    log_id: 1, business_type: 'work_order', target_id: 1, operation_id: 'change-1', operator_id: 3,
    field_name: 'urgency', old_value: '0', new_value: '1', created_at: '2026-09-02 10:00:00+08',
  }]
  const users = [
    { id: 1, name: '负责人', status: 1, is_deleted: 0 },
    { id: 2, name: '同名人员', status: 1, is_deleted: 0 },
    { id: 3, name: '同名人员', status: 1, is_deleted: 0 },
    { id: 4, name: '创建人', status: 1, is_deleted: 0 },
  ]
  const database = { prepare(sql) {
    if (/period_analysis:records:work_order/.test(sql)) return { all: async () => rows }
    if (/period_analysis:logs/.test(sql)) return { all: async () => logs }
    if (/period_analysis:(people|report_people)/.test(sql)) return { all: async (...ids) => users.filter(u => ids.flat().map(Number).includes(u.id)) }
    throw new Error(`Unexpected query: ${sql}`)
  } }
  return { rows, logs, users, database }
}

function call(args, data = fixture(), ctx = context) {
  return dispatchQueryTool('business_period_analysis', { ...base, ...args }, ctx, { database: data.database, now })
}

test('跨业务的状态和优先级分组不合并异义代码，并使用中文标签', async () => {
  const rows = ['task', 'bug', 'work_order'].map(business_type => ({
    ...fixture(1).rows[0], business_type,
  }))
  const database = { prepare(sql) {
    const type = /period_analysis:records:([a-z_]+)/.exec(sql)?.[1]
    if (type) return { all: async () => rows.filter(row => row.business_type === type) }
    return { all: async () => [] }
  } }
  const result = await call({ business_types: ['task', 'bug', 'work_order'], group_by: ['status', 'priority'] },
    { database }, { allowedMenuPaths: new Set(['/tasks', '/bugs', '/work-orders']) })
  assert.equal(result.groupings.status.length, 3)
  assert.deepEqual(Object.fromEntries(result.groupings.status.map(x => [x.key, x.label])), {
    'bug:1': 'BUG · 已修复', 'task:1': '任务 · 处理中', 'work_order:1': '运维工单 · 处理中',
  })
  assert.deepEqual(Object.fromEntries(result.groupings.priority.map(x => [x.key, x.label])), {
    'bug:1': 'BUG · 低', 'task:1': '任务 · 中', 'work_order:1': '运维工单 · 中',
  })
  assert.ok(result.groupings.status.every(x => x.current_stock.total === 1))
})

test('统计候选沿用中文枚举和富文本摘要，不带图片地址或内嵌正文', async () => {
  const data = fixture(1)
  data.rows[0].name += '<img src="data:image/png;base64,c2VjcmV0">'
  const result = await call({ detail_limit: 1 }, data)
  const item = result.flow_candidates.created.items[0]
  assert.equal(item.name, '工单 1 〔图片〕')
  assert.equal(item.status_label, '处理中')
  assert.equal(item.priority_label, '中')
  assert.equal(item.detail_target_id, 1)
  assert.deepEqual(item.owner_ids, [1])
  assert.ok(!JSON.stringify(item).includes('secret'))
  assert.ok(!JSON.stringify(item).includes('base64'))
})

test('变化明细按同口径稳定续页，全部记录与聚合对得上且不重复携带汇总', async () => {
  const data = fixture()
  const summary = await call({ detail_limit: 1 }, data)
  assert.equal(summary.period_flows.total.created, 120)
  const ids = []
  let datasetToken
  for (let page = 1; page <= 3; page++) {
    const result = await call({ detail_query: { source: 'flow', metric: 'created', page, page_size: 50,
      ...(datasetToken ? { dataset_token: datasetToken } : {}) } }, data)
    datasetToken = result.details.datasetToken
    assert.equal(result.period_flows, undefined)
    assert.equal(result.report_people, undefined)
    assert.equal(result.details.total, 120)
    assert.equal(result.details.page, page)
    assert.equal(result.details.totalPages, 3)
    assert.equal(result.details.hasNextPage, page < 3)
    ids.push(...result.details.items.map(x => x.target_id))
  }
  assert.equal(new Set(ids).size, 120)
  assert.deepEqual(ids, Array.from({ length: 120 }, (_, i) => i + 1))
  const beyond = await call({ detail_query: { source: 'flow', metric: 'created', page: 4, page_size: 50, dataset_token: datasetToken } }, data)
  assert.deepEqual(beyond.details.items, [])
  assert.equal(beyond.details.hasNextPage, false)
})

test('人员回查覆盖纯更新人、纯操作人，同时保留真实关系与唯一标识', async () => {
  const data = fixture(2)
  const updater = await call({ filters: { person_ids: [2] }, detail_query: { source: 'stock', metric: 'total' } }, data)
  assert.equal(updater.details.total, 2)
  assert.deepEqual(updater.details.items[0].people.find(p => p.user_id === 2).relations, ['updater'])
  const operator = await call({ filters: { person_ids: [3] }, detail_query: { source: 'stock', metric: 'total' } }, data)
  assert.equal(operator.details.total, 1)
  assert.deepEqual(operator.details.items[0].people.find(p => p.user_id === 3).relations, ['operator'])
  const ownerOnly = await call({ filters: { person_ids: [2], person_relation: 'business_role' }, detail_query: { source: 'stock', metric: 'total' } }, data)
  assert.equal(ownerOnly.details.total, 0)
})

test('人员操作关联受分析区间约束，不把旧操作当成本期贡献', async () => {
  const data = fixture(1)
  data.logs[0].created_at = '2026-08-01 10:00:00+08'
  const result = await call({ filters: { person_ids: [3], person_relation: 'operator' }, detail_query: { source: 'stock', metric: 'total' } }, data)
  assert.equal(result.details.total, 0)
})

test('阶段容器与关键事项编号相同时，不串用容器操作历史', async () => {
  const data = fixture(1)
  data.rows[0].business_type = 'stage_plan'
  data.rows[0].project_id = 7
  data.logs[0].business_type = 'stage_plan'
  data.logs[0].action = '编辑阶段'
  const queries = []
  const database = { prepare(sql) {
    queries.push(sql)
    if (/period_analysis:records:stage_plan/.test(sql)) return { all: async () => data.rows }
    if (/period_analysis:logs/.test(sql)) return { all: async () => /action NOT IN/.test(sql) ? [] : data.logs }
    if (/period_analysis:financials/.test(sql)) return { get: async () => ({}) }
    return data.database.prepare(sql)
  } }
  const args = { business_types: ['stage_plan'], filters: { project_ids: [7], person_ids: [3], person_relation: 'operator' } }
  const ctx = { allowedMenuPaths: new Set(['/projects']) }
  const result = await call({ ...args, detail_query: { source: 'stock', metric: 'total' } }, { database }, ctx)
  assert.equal(result.details.total, 0)
  assert.ok(queries.some(sql => /action NOT IN/.test(sql)))
  const summary = await call({ business_types: ['stage_plan'] }, { database }, ctx)
  assert.ok(!summary.report_people.some(person => person.user_id === 3))
})

test('风险、存量与计划明细复用同一集合，支持任意日期范围', async () => {
  const data = fixture(3)
  data.rows[2].status = 4
  data.rows[2].is_paused = true
  const args = { plan_period: { preset: 'month', anchor_date: '2026-09-01' } }
  const summary = await call(args, data)
  const stock = await call({ ...args, detail_query: { source: 'stock', metric: 'overdue' } }, data)
  const risk = await call({ ...args, detail_query: { source: 'risk', metric: 'overdue' } }, data)
  const plan = await call({ ...args, detail_query: { source: 'plan', metric: 'pending' } }, data)
  assert.equal(stock.details.total, 2)
  assert.equal(stock.details.total, summary.current_stock.total.overdue)
  assert.equal(risk.details.total, summary.risk_candidates.overdue.total)
  assert.equal(plan.details.total, summary.plan_outlook.total.pending)
})

test('人员清单可以分页，按唯一标识排序且不受候选条数限制', async () => {
  const data = fixture(1)
  const summary = await call({ detail_limit: 0 }, data)
  assert.equal(summary.report_people.length, 4)
  const first = await call({ detail_query: { source: 'people', page_size: 2 } }, data)
  const result = await call({ detail_query: { source: 'people', page: 2, page_size: 2, dataset_token: first.details.datasetToken } }, data)
  assert.equal(result.details.total, 4)
  assert.deepEqual(result.details.items.map(p => p.user_id), [3, 4])
})

test('明细错误参数不能被直接 dispatcher 查询分支静默忽略', async () => {
  const cases = [
    { source: 'other' }, { source: 'flow', metric: 'total' },
    { source: 'stock', metric: 'overdue', page: 0 }, { source: 'people', metric: 'created' },
    { source: 'people', page_size: 101 }, { source: 'plan', metric: 'planned' },
  ]
  for (const detail_query of cases) {
    await assert.rejects(call({ detail_query }, fixture(0)), e => e.code === 'MCP_ARGUMENT_INVALID')
  }
})

test('明细查询继承授权业务范围，不返回未授权模块数据', async () => {
  const result = await call({ detail_query: { source: 'stock', metric: 'total' } }, fixture(), { allowedMenuPaths: new Set() })
  assert.equal(result.details.total, 0)
  assert.deepEqual(result.coverage.authorized_business_types, [])
})
