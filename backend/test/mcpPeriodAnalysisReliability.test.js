const assert = require('node:assert/strict')
const test = require('node:test')
const { analyzeBusinessPeriod } = require('../src/services/mcpPeriodAnalysisService')

const NOW = new Date('2026-09-08T04:00:00Z')
const period = (start, end = start) => ({ preset: 'custom', start_date: start, end_date: end })
const context = { user: { id: 8 }, allowedMenuPaths: new Set(['/projects', '/requirements', '/tasks', '/bugs', '/work-orders']) }
function row(values = {}) {
  return { business_type: 'task', id: 1, name: '周期核验', status: 1, priority: 1,
    product_id: 11, product_name: '产品', project_id: 12, project_name: '项目', requirement_id: null,
    requirement_name: null, owner_id: 8, owner_name: '本人', owner_ids: [8], business_role_ids: [8],
    person_ids: [8], creator_id: 8, updater_id: 8, parent_task_id: null,
    plan_date: '2026-09-04', actual_date: null, pause_date: null,
    created_at: '2026-08-01 09:00:00+08', is_completed: false, is_paused: false, is_overdue: 0,
    parent_project_paused: false, required_delivery: false, delivery_count: 0, ...values }
}
function log(values = {}) {
  return { business_type: 'task', target_id: 1, log_id: 1, operation_id: 'change-1', operator_id: 8,
    action: '编辑', field_name: 'priority', old_value: '0', new_value: '1', created_at: '2026-09-04 10:00:00+08', ...values }
}
function fixture(rows = [row()], logs = []) {
  const users = [{ id: 8, name: '本人', status: 1, is_deleted: 0 }, { id: 9, name: '他人', status: 1, is_deleted: 0 }]
  const state = { rows, logs, users, financialError: false }
  state.database = { prepare(sql) {
    const type = /period_analysis:records:([a-z_]+)/.exec(sql)?.[1]
    if (type) return { all: async () => state.rows.filter(item => item.business_type === type) }
    if (/period_analysis:logs/.test(sql)) return { all: async () => state.logs }
    if (/period_analysis:(people|report_people)/.test(sql)) return { all: async (...ids) => state.users.filter(user => ids.flat().map(Number).includes(user.id)) }
    if (/period_analysis:financials/.test(sql)) return { get: async () => {
      if (state.financialError) throw new Error('offline financial fixture unavailable')
      return {}
    } }
    throw new Error(`Unexpected query: ${sql}`)
  } }
  return state
}
function call(data = fixture(), args = {}, ctx = context, now = NOW) {
  return analyzeBusinessPeriod({ analysis_period: period('2026-08-31', '2026-09-06'),
    business_types: [...new Set(data.rows.map(item => item.business_type))], ...args }, ctx, data.database, now)
}

test('部分BUG历史漏掉关闭事件时披露流量不完整，不把零完成标成可信全量', async () => {
  const data = fixture([row({ business_type: 'bug', status: 2, is_completed: true, plan_date: null,
    actual_date: '2026-09-04', resolved_date: '2026-09-02' })],
  [log({ business_type: 'bug', field_name: 'status', old_value: '0', new_value: '1', created_at: '2026-09-02 10:00:00+08' })])
  const result = await call(data, { plan_period: period('2026-01-01', '2026-12-31'), completion_cutoff: '2026-09-06' })
  assert.equal(result.coverage.statistics_complete, false)
  assert.equal(result.coverage.component_completeness.period_flows, false)
  assert.equal(result.coverage.component_completeness.current_stock, true)
  assert.equal(result.coverage.event_history_inconsistent_count, 1)
  assert.equal(result.period_flows.total.completed, 0)
  const createdOnly = await call(data, { metrics: ['created'] })
  assert.equal(createdOnly.coverage.statistics_complete, true)
  assert.equal(createdOnly.coverage.component_completeness.event_history, false)
})

test('拒绝类需求排除可执行存量与年度和下周计划，但保留总台账且不伪造完成', async () => {
  const data = fixture([3, 13, 22].map((status, index) => row({ business_type: 'requirement', id: index + 1,
    status, plan_date: '2026-09-10' })))
  const result = await call(data, { plan_period: period('2026-09-07', '2026-09-13') })
  assert.equal(result.current_stock.total.total, 3)
  assert.equal(result.current_stock.total.unfinished, 0)
  assert.deepEqual(result.plan_outlook.total, { planned: 0, completed: 0, pending: 0 })
  assert.equal(result.period_flows.total.completed, 0)
  const details = await call(data, { detail_query: { source: 'stock', metric: 'unfinished' } })
  assert.equal(details.details.total, 0)
  const annual = await call(data, { plan_period: period('2026-01-01', '2026-12-31') })
  assert.equal(annual.plan_outlook.total.planned, 0)
})

test('重复事项按每个趋势桶分别去重，年度总数仍按事项去重', async () => {
  const data = fixture([row()], [log({ created_at: '2026-08-25 10:00:00+08' }),
    log({ log_id: 2, operation_id: 'change-2', old_value: '1', new_value: '2' }),
    log({ log_id: 3, operation_id: 'change-3', old_value: '2', new_value: '1', created_at: '2026-09-05 10:00:00+08' })])
  const result = await call(data, { analysis_period: period('2026-08-24', '2026-09-06'), trend_granularity: 'week' })
  assert.equal(result.period_flows.total.important_adjustments, 1)
  assert.deepEqual(result.trend.buckets.map(bucket => bucket.period_flows.important_adjustments), [1, 1])
})

test('辅助财务不可用不污染六类核心统计完整性', async () => {
  const data = fixture()
  data.financialError = true
  const result = await call(data)
  assert.equal(result.coverage.statistics_complete, true)
  assert.equal(result.coverage.component_completeness.financials, false)
  assert.equal(result.coverage.component_completeness.business_records, true)
  assert.equal(result.coverage.component_completeness.risk_candidates, true)
  assert.equal(result.financials.available, false)
})

test('本人周期范围只能取认证用户ID，不能注入人员ID或退回全量', async () => {
  const data = fixture([row(), row({ id: 2, owner_id: 9, owner_ids: [9], business_role_ids: [9],
    person_ids: [9], creator_id: 9, updater_id: 9 })])
  const result = await call(data, { filters: { person_scope: 'self' } })
  assert.equal(result.current_stock.total.total, 1)
  for (const person_ids of [[], [9]]) {
    await assert.rejects(call(data, { filters: { person_scope: 'self', person_ids } }), error => error.code === 'MCP_ARGUMENT_INVALID')
  }
  await assert.rejects(call(data, { filters: { person_scope: 'self' } }, { ...context, user: {} }),
    error => error.code === 'MCP_PERMISSION_DENIED')
})

test('续页固定页大小以免漏项，同数据及页大小允许查询开始时间改变', async () => {
  const data = fixture([row(), row({ id: 2 }), row({ id: 3 })])
  const first = await call(data, { detail_query: { source: 'stock', metric: 'total', page_size: 1 } })
  assert.match(first.details.datasetToken, /^[a-f0-9]{64}$/)
  await assert.rejects(call(data, { detail_query: { source: 'stock', metric: 'total', page: 2, page_size: 2,
    dataset_token: first.details.datasetToken } }), error => error.code === 'MCP_DATA_CHANGED')
  const second = await call(data, { detail_query: { source: 'stock', metric: 'total', page: 2, page_size: 1,
    dataset_token: first.details.datasetToken } }, context, new Date('2026-09-08T04:00:15Z'))
  assert.deepEqual(second.details.items.map(item => item.target_id), [2])
  assert.equal(second.details.datasetToken, first.details.datasetToken)
  assert.equal(second.details.dataset_token, undefined)
  const third = await call(data, { detail_query: { source: 'stock', metric: 'total', page: 3, page_size: 1,
    dataset_token: first.details.datasetToken } })
  assert.deepEqual([...first.details.items, ...second.details.items, ...third.details.items].map(item => item.target_id), [1, 2, 3])
  assert.equal(third.details.hasNextPage, false)
  const restarted = await call(data, { detail_query: { source: 'stock', metric: 'total', page_size: 2 } })
  assert.deepEqual(restarted.details.items.map(item => item.target_id), [1, 2])
  assert.notEqual(restarted.details.datasetToken, first.details.datasetToken)
  await assert.rejects(call(data, { detail_query: { source: 'stock', metric: 'total', page: 2 } }),
    error => error.code === 'MCP_ARGUMENT_INVALID')
})

test('同总数替换记录、修改历史或人员、跨身份权限及查询口径均拒绝旧令牌', async () => {
  for (const mutate of [
    data => { data.rows[1] = row({ id: 3 }) },
    data => { data.logs.push(log({ operator_id: 9 })) },
    data => { data.users[0].name = '修改后的姓名' },
    data => { data.rows[1].plan_date = '2026-09-05' },
  ]) {
    const data = fixture([row(), row({ id: 2 })])
    const first = await call(data, { detail_query: { source: 'stock', metric: 'total', page_size: 1 } })
    mutate(data)
    await assert.rejects(call(data, { detail_query: { source: 'stock', metric: 'total', page: 2, page_size: 1,
      dataset_token: first.details.datasetToken } }), error => error.code === 'MCP_DATA_CHANGED')
  }
  const data = fixture([row(), row({ id: 2 })])
  const first = await call(data, { detail_query: { source: 'stock', metric: 'total', page_size: 1 } })
  const args = { detail_query: { source: 'stock', metric: 'total', page: 2, page_size: 1, dataset_token: first.details.datasetToken } }
  for (const ctx of [{ ...context, user: { id: 9 } }, { ...context, allowedMenuPaths: new Set(['/tasks']) }]) {
    await assert.rejects(call(data, args, ctx), error => error.code === 'MCP_DATA_CHANGED')
  }
  await assert.rejects(call(data, { ...args, filters: { person_relation: 'creator' } }), error => error.code === 'MCP_DATA_CHANGED')
})

test('明细令牌仅绑定选中集合和展示依据，缓存及无关历史变化不阻断续页', async () => {
  const data = fixture([row(), row({ id: 2 }), row({ id: 3, status: 2, is_completed: true })], [log()])
  const query = { source: 'stock', metric: 'unfinished', page_size: 1 }
  const first = await call(data, { detail_query: query })
  data.rows[0].is_overdue = 1
  data.rows[2].name = '不在本次集合中的名称变化'
  data.logs.push(log({ log_id: 2, operation_id: 'unrelated', field_name: 'description', old_value: 'a', new_value: 'b' }))
  data.logs.push(log({ log_id: 3, operation_id: 'old', operator_id: 9, created_at: '2025-01-01 10:00:00+08' }))
  const second = await call(data, { detail_query: { ...query, page: 2, dataset_token: first.details.datasetToken } })
  assert.equal(second.details.total, 2)
  assert.equal(second.details.items[0].target_id, 2)
  assert.equal(second.details.datasetToken, first.details.datasetToken)
})

test('任意已选事项的可见名称、状态、负责人及计划改变均拒绝旧令牌', async () => {
  for (const change of [
    { name: '新名称' }, { status: 3, is_paused: true }, { project_name: '新项目名称' },
    { owner_ids: [9], business_role_ids: [9], owner_id: 9, owner_name: '他人' }, { plan_date: '2026-09-05' },
  ]) {
    const data = fixture([row(), row({ id: 2 })])
    const query = { source: 'stock', metric: 'total', page_size: 1 }
    const first = await call(data, { detail_query: query })
    Object.assign(data.rows[1], change)
    await assert.rejects(call(data, { detail_query: { ...query, page: 2, dataset_token: first.details.datasetToken } }),
      error => error.code === 'MCP_DATA_CHANGED')
  }
})

test('事件明细仅绑定该指标展示的变化，计划明细绑定完成依据', async () => {
  const data = fixture([row(), row({ id: 2 })], [log(), log({ target_id: 2, log_id: 2, operation_id: 'other' })])
  const query = { source: 'flow', metric: 'important_adjustments', page_size: 1 }
  const first = await call(data, { detail_query: query })
  data.logs.push(log({ log_id: 3, operation_id: 'irrelevant', field_name: 'description', old_value: 'a', new_value: 'b' }))
  const next = await call(data, { detail_query: { ...query, page: 2, dataset_token: first.details.datasetToken } })
  assert.equal(next.details.datasetToken, first.details.datasetToken)
  data.logs[1].new_value = '2'
  await assert.rejects(call(data, { detail_query: { ...query, page: 2, dataset_token: first.details.datasetToken } }),
    error => error.code === 'MCP_DATA_CHANGED')

  const planned = fixture([row({ status: 2, is_completed: true, actual_date: '2026-09-04' }),
    row({ id: 2, status: 2, is_completed: true, actual_date: '2026-09-04' })])
  const options = { plan_period: period('2026-09-01', '2026-09-06'), completion_cutoff: '2026-09-06' }
  const planQuery = { source: 'plan', metric: 'completed', page_size: 1 }
  const planFirst = await call(planned, { ...options, detail_query: planQuery })
  planned.rows[1].actual_date = '2026-09-05'
  await assert.rejects(call(planned, { ...options, detail_query: { ...planQuery, page: 2, dataset_token: planFirst.details.datasetToken } }),
    error => error.code === 'MCP_DATA_CHANGED')
})

test('人员及负责人集中集合的计数不变但关联事项替换时也拒绝旧令牌', async () => {
  for (const query of [{ source: 'people', page_size: 1 }, { source: 'risk', metric: 'workload_concentration', page_size: 1 }]) {
    const data = fixture([row(), row({ id: 2 })])
    const first = await call(data, { detail_query: query })
    data.rows[1].id = 3
    await assert.rejects(call(data, { detail_query: { ...query, page: 2, dataset_token: first.details.datasetToken } }),
      error => error.code === 'MCP_DATA_CHANGED')
  }
})

test('查询失败只披露稳定业务说明和组件状态，不泄露底层SQL或连接信息', async () => {
  for (const [queryMarker, component] of [['records:task', 'business_records'], ['logs', 'event_history'],
    ['report_people', 'report_people'], ['financials', 'financials']]) {
    const data = fixture()
    const prepare = data.database.prepare
    data.database.prepare = sql => {
      if (sql.includes(`period_analysis:${queryMarker}`)) {
        const fail = async () => { throw new Error('sensitive SQL SELECT password FROM internal_table; pg://admin:secret@private-host') }
        return { all: fail, get: fail }
      }
      return prepare(sql)
    }
    const result = await call(data)
    assert.doesNotMatch(JSON.stringify(result), /sensitive|password|internal_table|admin|secret|private-host/)
    assert.equal(result.coverage.component_completeness[component], false)
    if (component === 'business_records') {
      assert.equal(result.coverage.component_completeness.financials, false)
      assert.equal(result.financials.available, false)
    }
  }
})

test('原始记录和日志读取顺序不改变明细令牌，但跨日风险观察口径改变时拒绝续页', async () => {
  const data = fixture([row(), row({ id: 2 })], [log(), log({ target_id: 2, log_id: 2, operation_id: 'change-2' })])
  const first = await call(data, { detail_query: { source: 'stock', metric: 'total', page_size: 1 } })
  data.rows.reverse()
  data.logs.reverse()
  const args = { detail_query: { source: 'stock', metric: 'total', page: 2, page_size: 1, dataset_token: first.details.datasetToken } }
  const second = await call(data, args)
  assert.equal(second.details.datasetToken, first.details.datasetToken)
  assert.deepEqual(second.details.items.map(item => item.target_id), [2])
  await assert.rejects(call(data, args, context, new Date('2026-09-09T04:00:00Z')), error => error.code === 'MCP_DATA_CHANGED')
})

test('跨周完成重开再完成按桶分别计数，保留业务日期而非登记日期', async () => {
  const statusChange = (id, operation, oldStatus, newStatus, recorded, actual) => [
    log({ log_id: id, operation_id: operation, field_name: 'status', old_value: String(oldStatus), new_value: String(newStatus), created_at: recorded }),
    ...(actual ? [log({ log_id: id + 1, operation_id: operation, field_name: 'actual_end_date', old_value: null, new_value: actual, created_at: recorded })] : []),
  ]
  const data = fixture([row({ status: 2, is_completed: true, actual_date: '2026-09-04' })], [
    ...statusChange(1, 'finish-first', 1, 2, '2026-08-26 10:00:00+08', '2026-08-25'),
    ...statusChange(3, 'reopen', 2, 1, '2026-09-01 10:00:00+08'),
    ...statusChange(4, 'finish-again', 1, 2, '2026-09-07 10:00:00+08', '2026-09-04'),
  ])
  const result = await call(data, { analysis_period: period('2026-08-24', '2026-09-06'), trend_granularity: 'week' })
  assert.equal(result.period_flows.total.completed, 1)
  assert.deepEqual(result.trend.buckets.map(bucket => bucket.period_flows.completed), [1, 1])
  const week = await call(data)
  assert.equal(week.flow_candidates.completed.items[0].actual_date, '2026-09-04')
  assert.equal(week.flow_candidates.completed.items[0].recorded_date, '2026-09-07')
})

test('通用能力边界明确披露，不将BUG计划或其他不支持能力的零值视为有效统计', async () => {
  const data = fixture([row({ business_type: 'bug', plan_date: null })])
  const options = { analysis_period: { preset: 'workday', anchor_date: '2026-09-08' },
    plan_period: period('2026-09-07', '2026-09-13') }
  const summary = await call(data, options)
  assert.equal(summary.plan_outlook.total.planned, 0)
  const detail = await call(data, { ...options, detail_query: { source: 'plan', metric: 'planned' } })
  assert.equal(detail.details.total, 0)
  for (const result of [summary, detail]) {
    for (const dimension of ['bug_plan_dates', 'holiday_and_makeup_workdays', 'expected_resume_dates',
      'business_dependencies', 'operation_permission_roster']) {
      assert.ok(result.coverage.unsupported_dimensions.includes(dimension), `缺少能力边界：${dimension}`)
    }
    assert.match(result.coverage.notes.join('\n'), /不代表.*零|不能.*零/)
  }
})
