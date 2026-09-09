const assert = require('node:assert/strict')
const test = require('node:test')
const { analyzeBusinessPeriod } = require('../src/services/mcpPeriodAnalysisService')

const NOW = new Date('2026-09-08T04:00:00Z')
const period = (start, end = start) => ({ preset: 'custom', start_date: start, end_date: end })
function record(values = {}) {
  return { business_type: 'task', id: 1, name: '统计核验', status: 1, priority: 1,
    owner_id: null, owner_ids: [], person_ids: [], business_role_ids: [],
    plan_date: '2026-09-04', actual_date: null, created_at: '2026-08-01T01:00:00Z',
    is_completed: false, is_paused: false, is_overdue: 0,
    parent_project_paused: false, required_delivery: false, delivery_count: 0, ...values }
}
function transition(type, id, operation, oldStatus, newStatus, recorded, field, actual) {
  const base = { business_type: type, target_id: id, operation_id: operation,
    created_at: recorded, operator_id: null }
  return [{ ...base, field_name: 'status', old_value: String(oldStatus), new_value: String(newStatus) },
    ...(field ? [{ ...base, field_name: field, old_value: null, new_value: actual }] : [])]
}
function database(records, logs) {
  return { prepare(sql) {
    const match = /period_analysis:records:([a-z_]+)/.exec(sql)
    if (match) return { all: async () => records.filter((row) => row.business_type === match[1]) }
    if (/period_analysis:logs/.test(sql)) return { all: async () => logs }
    if (/period_analysis:(people|report_people)/.test(sql)) return { all: async () => [] }
    if (/period_analysis:financials/.test(sql)) return { get: async () => ({}) }
    throw new Error(`Unexpected SQL: ${sql}`)
  } }
}

test('多人共同负责的逾期事项分别归入每位负责人，单据全局计数不重复', async () => {
  const rows = [
    record({ id: 1, owner_id: 1, owner_ids: [1, 3, 3], business_role_ids: [1, 3], owner_name: '甲、丙' }),
    record({ id: 2, owner_id: 2, owner_ids: [2, 3], business_role_ids: [2, 3], owner_name: '乙、丙' }),
  ]
  const result = await analyze(rows)
  assert.equal(result.current_stock.total.overdue, 2)
  assert.deepEqual(result.risk_candidates.workload_concentration.items.map(x => [x.owner_id, x.overdue_count]), [[3, 2]])
  assert.notEqual(result.risk_candidates.workload_concentration.items[0].owner_name, '甲、丙')
  const filtered = await analyze(rows, [], { filters: { person_ids: [3], person_relation: 'business_role' } })
  assert.equal(filtered.risk_candidates.workload_concentration.items[0].overdue_count, 2)
})

test('计划调整按受影响事项去重，不受同次操作字段和多次操作顺序影响', async () => {
  const base = { business_type: 'task', target_id: 1, operation_id: 'adjust', operator_id: 1,
    created_at: '2026-09-03T02:00:00Z' }
  const owner = { ...base, log_id: 1, field_name: 'owner_ids', old_value: '[1]', new_value: '[2]' }
  const plan = { ...base, log_id: 2, field_name: 'expected_end_date', old_value: '2026-09-02', new_value: '2026-09-04' }
  for (const logs of [[owner, plan], [plan, owner], [owner, { ...plan, operation_id: 'later', created_at: '2026-09-04T02:00:00Z' }]]) {
    const result = await analyze([record()], logs)
    assert.equal(result.period_flows.total.important_adjustments, 1)
    assert.equal(result.quality_and_delivery.schedule_adjustments, 1)
  }
  const ownersOnly = await analyze([record()], [owner])
  assert.equal(ownersOnly.quality_and_delivery.schedule_adjustments, 0)
})

test('同次暂停或恢复与计划调整保留全部字段，不因状态日志先后漏计', async () => {
  for (const [previous, status] of [[1, 3], [3, 1]]) {
    const base = { business_type: 'task', target_id: 1, operation_id: 'combined', created_at: '2026-09-03T02:00:00Z' }
    const changeStatus = { ...base, log_id: 1, field_name: 'status', old_value: String(previous), new_value: String(status) }
    const changePlan = { ...base, log_id: 2, field_name: 'expected_end_date', old_value: '2026-09-02', new_value: '2026-09-04' }
    for (const logs of [[changeStatus, changePlan], [changePlan, changeStatus]]) {
      const result = await analyze([record({ status, is_paused: status === 3 })], logs)
      assert.equal(result.quality_and_delivery.schedule_adjustments, 1)
      assert.deepEqual(result.flow_candidates.important_adjustments.items[0].changes.map(x => x.field_name).sort(), ['expected_end_date', 'status'])
    }
  }
})

test('补录暂停与同次计划调整按各自实际发生日期归属，不把计划调整倒填到暂停日', async () => {
  const logs = transition('task', 1, 'backfill', 1, 3, '2026-09-07T02:00:00Z', 'suspend_date', '2026-09-02')
  logs.push({ ...logs[0], field_name: 'expected_end_date', old_value: '2026-09-02', new_value: '2026-09-04' })
  const rows = [record({ status: 3, is_paused: true, pause_date: '2026-09-02' })]
  for (const ordered of [logs, [...logs].reverse()]) {
    const pauseDay = await analyze(rows, ordered, { analysis_period: period('2026-09-02') })
    assert.equal(pauseDay.period_flows.total.paused, 1)
    assert.equal(pauseDay.quality_and_delivery.schedule_adjustments, 0)
    const updateDay = await analyze(rows, ordered, { analysis_period: period('2026-09-07') })
    assert.equal(updateDay.quality_and_delivery.schedule_adjustments, 1)
  }
})
async function analyze(records, logs = [], args = {}) {
  return analyzeBusinessPeriod({ analysis_period: period('2026-09-01', '2026-09-08'),
    business_types: [...new Set(records.map((row) => row.business_type))], ...args },
  { allowedMenuPaths: new Set(['/projects', '/requirements', '/tasks', '/bugs', '/work-orders']) },
  database(records, logs), NOW)
}

test('完成截止日与计划归属区间独立，支持检查区间结束后的实际完成', async () => {
  const rows = [record({ status: 2, is_completed: true, actual_date: '2026-09-07' })]
  const logs = transition('task', 1, 'complete', 1, 2, '2026-09-07T04:00:00Z', 'actual_end_date', '2026-09-07')
  const later = await analyze(rows, logs, { plan_period: period('2026-09-01', '2026-09-06'), completion_cutoff: '2026-09-08' })
  assert.deepEqual(later.plan_outlook.total, { planned: 1, completed: 1, pending: 0 })
  const earlier = await analyze(rows, logs, { plan_period: period('2026-09-01', '2026-09-06') })
  assert.deepEqual(earlier.plan_outlook.total, { planned: 1, completed: 0, pending: 1 })
  assert.equal(earlier.coverage.completion_cutoff, '2026-09-06')
})

test('截止日后重开不抹掉截止日时已完成，当前激活工单不因残留日期算完成', async () => {
  const rows = [record({ business_type: 'work_order', status: 5, actual_date: '2026-09-04' })]
  const logs = [
    ...transition('work_order', 1, 'resolved', 1, 2, '2026-09-04T04:00:00Z', 'resolve_date', '2026-09-04'),
    ...transition('work_order', 1, 'reopen', 2, 5, '2026-09-07T04:00:00Z'),
  ]
  const old = await analyze(rows, logs, { plan_period: period('2026-09-01', '2026-09-06'), completion_cutoff: '2026-09-06' })
  assert.deepEqual(old.plan_outlook.total, { planned: 1, completed: 1, pending: 0 })
  const current = await analyze(rows, logs, { plan_period: period('2026-09-01', '2026-09-08'), completion_cutoff: '2026-09-08' })
  assert.deepEqual(current.plan_outlook.total, { planned: 1, completed: 0, pending: 1 })
})

test('历史不足的激活工单不伪造截止日完成并显式披露不确定数量', async () => {
  const result = await analyze([record({ business_type: 'work_order', status: 5, actual_date: '2026-09-04' })], [],
    { plan_period: period('2026-09-01', '2026-09-06'), completion_cutoff: '2026-09-06' })
  assert.equal(result.plan_outlook.total.completed, 0)
  assert.equal(result.coverage.plan_completion_unknown_count, 1)
  assert.equal(result.coverage.plan_completion_complete, false)
})

test('历史截止时当前未完成且没有实际日期或状态日志也必须披露未知，今天不误判未知', async () => {
  const rows = [record()]
  const options = { sections: ['plan_outlook'], plan_period: period('2026-09-01', '2026-09-06') }
  const historical = await analyze(rows, [], options)
  assert.deepEqual(historical.plan_outlook.total, { planned: 1, completed: 0, pending: 1 })
  assert.equal(historical.coverage.plan_completion_unknown_count, 1)
  assert.equal(historical.coverage.plan_completion_complete, false)
  assert.equal(historical.coverage.statistics_complete, false)
  const current = await analyze(rows, [], { ...options, completion_cutoff: '2026-09-08' })
  assert.equal(current.coverage.plan_completion_unknown_count, 0)
  assert.equal(current.coverage.statistics_complete, true)
  const logs = [
    ...transition('task', 1, 'done', 1, 2, '2026-09-05T04:00:00Z', 'actual_end_date', '2026-09-05'),
    ...transition('task', 1, 'reopen', 2, 1, '2026-09-07T04:00:00Z'),
  ]
  const proven = await analyze(rows, logs, options)
  assert.equal(proven.plan_outlook.total.completed, 1)
  assert.equal(proven.coverage.plan_completion_unknown_count, 0)
  assert.equal(proven.coverage.statistics_complete, true)
})

test('补录完成归入实际日期，recorded 口径仍能检查登记日', async () => {
  const rows = [record({ status: 2, is_completed: true, actual_date: '2026-09-04' })]
  const logs = transition('task', 1, 'late-entry', 1, 2, '2026-09-07T04:00:00Z', 'actual_end_date', '2026-09-04')
  const actual = await analyze(rows, logs, { analysis_period: period('2026-09-04'), trend_granularity: 'day' })
  assert.equal(actual.period_flows.total.completed, 1)
  assert.equal(actual.flow_candidates.completed.items[0].event_date, '2026-09-04')
  assert.equal(actual.coverage.event_time_basis, 'actual')
  const recorded = await analyze(rows, logs, { analysis_period: period('2026-09-07'), event_time_basis: 'recorded' })
  assert.equal(recorded.period_flows.total.completed, 1)
  assert.equal(recorded.flow_candidates.completed.items[0].actual_date, '2026-09-04')
})

test('BUG 修复和关闭分别采用 resolved_date 与 closed_date', async () => {
  const rows = [record({ business_type: 'bug', status: 2, is_completed: true, plan_date: null,
    actual_date: '2026-09-06', resolved_date: '2026-09-03' })]
  const logs = [
    ...transition('bug', 1, 'fixed', 0, 1, '2026-09-05T04:00:00Z', 'resolved_date', '2026-09-03'),
    ...transition('bug', 1, 'closed', 1, 2, '2026-09-07T04:00:00Z', 'closed_date', '2026-09-06'),
  ]
  const fixed = await analyze(rows, logs, { analysis_period: period('2026-09-03') })
  assert.equal(fixed.period_flows.total.fixed, 1)
  assert.equal(fixed.flow_candidates.fixed.items[0].actual_date, '2026-09-03')
  const closed = await analyze(rows, logs, { analysis_period: period('2026-09-06') })
  assert.equal(closed.period_flows.total.completed, 1)
})

test('暂停采用业务暂停日期且到期前暂停不产生逾期流量', async () => {
  const rows = [record({ status: 3, is_paused: true, pause_date: '2026-09-02' })]
  const logs = transition('task', 1, 'pause', 1, 3, '2026-09-07T04:00:00Z', 'suspend_date', '2026-09-02')
  const result = await analyze(rows, logs)
  assert.equal(result.flow_candidates.paused.items[0].event_date, '2026-09-02')
  assert.equal(result.period_flows.total.became_overdue, 0)
})

test('暂停跨过到期日后恢复，从恢复日进入逾期而不是计划日次日', async () => {
  const logs = [
    ...transition('task', 1, 'pause', 1, 3, '2026-09-02T04:00:00Z', 'suspend_date', '2026-09-02'),
    ...transition('task', 1, 'resume', 3, 1, '2026-09-07T04:00:00Z'),
  ]
  const result = await analyze([record()], logs)
  assert.equal(result.flow_candidates.became_overdue.items[0].event_date, '2026-09-07')
})

test('需求拒绝终态复用业务逾期规则，不能使用过期缓存', async () => {
  const rows = [3, 13, 22].map((status, index) => record({ business_type: 'requirement', id: index + 1, status, is_overdue: 1 }))
  const logs = rows.flatMap((row) => transition('requirement', row.id, `reject-${row.id}`, 1, row.status, '2026-09-02T04:00:00Z'))
  const result = await analyze(rows, logs)
  assert.equal(result.current_stock.total.overdue, 0)
  assert.equal(result.risk_candidates.overdue.total, 0)
  assert.equal(result.period_flows.total.became_overdue, 0)
  const future = await analyze([record({ plan_date: '2026-09-30', is_overdue: 1 })])
  assert.equal(future.current_stock.total.overdue, 0)
})

test('默认完成截止日使用上海今天且拒绝未来截止日和非法事件口径', async () => {
  const result = await analyze([record()], [], { plan_period: period('2026-09-01', '2026-09-30') })
  assert.equal(result.coverage.completion_cutoff, '2026-09-08')
  for (const value of ['2026-02-30', '2026-09-09']) {
    await assert.rejects(analyze([record()], [], { completion_cutoff: value }),
      (error) => error.code === 'MCP_ARGUMENT_INVALID' && Boolean(error.fieldErrors.completion_cutoff))
  }
  await assert.rejects(analyze([record()], [], { event_time_basis: 'updated' }),
    (error) => error.code === 'MCP_ARGUMENT_INVALID' && Boolean(error.fieldErrors.event_time_basis))
})

test('coverage 明确当前未删除总体与不完整历史台账的边界', async () => {
  const result = await analyze([record()])
  assert.equal(result.coverage.population_basis, 'current_non_deleted_records')
  assert.equal(result.coverage.historical_ledger_complete, false)
  assert.equal(result.coverage.historical_plan_versions_supported, false)
  assert.match(result.coverage.notes.join('\n'), /暂停|计划/)
})

test('曾经逾期但完成后又重开，在新的分析区间再次产生进入逾期', async () => {
  const logs = [
    ...transition('task', 1, 'finish', 1, 2, '2026-09-06T04:00:00Z', 'actual_end_date', '2026-09-06'),
    ...transition('task', 1, 'again', 2, 1, '2026-09-08T04:00:00Z'),
  ]
  const result = await analyze([record()], logs, { analysis_period: period('2026-09-08') })
  assert.equal(result.period_flows.total.became_overdue, 1)
  assert.equal(result.flow_candidates.became_overdue.items[0].event_date, '2026-09-08')
})

test('状态历史缺漏且无法确定完成日期时不得标成确定待完成', async () => {
  const rows = [record({ status: 2, is_completed: true, actual_date: null })]
  const result = await analyze(rows, [], { plan_period: period('2026-09-01', '2026-09-06') })
  assert.equal(result.coverage.plan_completion_unknown_count, 1)
  assert.equal(result.coverage.statistics_complete, false)
})

test('无状态日志但当前完成日期明确时以有来源业务日期补全完成流量', async () => {
  const rows = [record({ status: 2, is_completed: true, actual_date: '2026-09-04', updated_at: '2026-09-08T00:00:00Z' })]
  const result = await analyze(rows, [], { analysis_period: period('2026-09-04'), plan_period: period('2026-09-04') })
  assert.equal(result.period_flows.total.completed, 1)
  assert.equal(result.plan_outlook.total.completed, 1)
  assert.equal(result.flow_candidates.completed.items[0].date_source, 'current_business_date_without_status_log')
  assert.equal(result.flow_candidates.completed.items[0].recorded_date, null)
  const recorded = await analyze(rows, [], { event_time_basis: 'recorded' })
  assert.equal(recorded.period_flows.total.completed, 0)
})

test('无状态日志的BUG分别以修复日期和关闭日期补全，不把已激活残留日期当完成', async () => {
  const rows = [record({ business_type: 'bug', status: 2, is_completed: true, plan_date: null,
    resolved_date: '2026-09-03', actual_date: '2026-09-06' })]
  const fixed = await analyze(rows, [], { analysis_period: period('2026-09-03') })
  assert.equal(fixed.period_flows.total.fixed, 1)
  assert.equal(fixed.period_flows.total.completed, 0)
  const closed = await analyze(rows, [], { analysis_period: period('2026-09-06') })
  assert.equal(closed.period_flows.total.completed, 1)
  assert.equal(closed.period_flows.total.fixed, 0)
  const reopened = await analyze([
    record({ business_type: 'work_order', id: 2, status: 5, actual_date: '2026-09-04' }),
    record({ business_type: 'bug', id: 3, status: 3, resolved_date: '2026-09-03', actual_date: '2026-09-06' }),
  ])
  assert.equal(reopened.period_flows.total.completed, 0)
  assert.equal(reopened.period_flows.total.fixed, 0)
})

test('补充业务日期事件不会覆盖完整日志的日期或重复制造跨日完成', async () => {
  const rows = [record({ status: 2, is_completed: true, actual_date: '2026-09-05' })]
  const logs = transition('task', 1, 'complete', 1, 2, '2026-09-06T04:00:00Z', 'actual_end_date', '2026-09-04')
  const result = await analyze(rows, logs, { analysis_period: period('2026-09-05') })
  assert.equal(result.period_flows.total.completed, 0)
})

test('PG真实短时区时间戳按时间排序，不因T分隔符与+08产生NaN', async () => {
  const rows = [record({ status: 2, is_completed: true, actual_date: '2026-09-04', created_at: '2026-08-01T09:00:00+08' })]
  const logs = [
    ...transition('task', 1, 'second', 1, 2, '2026-09-04T15:00:00+08', 'actual_end_date', '2026-09-04'),
    ...transition('task', 1, 'first', 0, 1, '2026-09-04 09:00:00.123456+08'),
  ]
  let result
  await assert.doesNotReject(async () => {
    result = await analyze(rows, logs, { analysis_period: period('2026-09-04'), plan_period: period('2026-09-04') })
  })
  assert.equal(result.plan_outlook.total.completed, 1)
  assert.equal(result.coverage.plan_completion_unknown_count, 0)
})

test('PG无时区时间戳采用上海日期，不将创建时间跨到下一天', async () => {
  const result = await analyze([record({ created_at: '2026-09-04T23:30:00' })], [], { analysis_period: period('2026-09-04') })
  assert.equal(result.period_flows.total.created, 1)
})

test('进入逾期当天才完成仍属于迟一天完成，不能抹掉当天逾期流量', async () => {
  const rows = [record({ status: 2, is_completed: true, actual_date: '2026-09-05' })]
  const logs = transition('task', 1, 'late-one-day', 1, 2, '2026-09-05 16:00:00+08', 'actual_end_date', '2026-09-05')
  const result = await analyze(rows, logs, { analysis_period: period('2026-09-05') })
  assert.equal(result.period_flows.total.completed, 1)
  assert.equal(result.quality_and_delivery.delayed_completed, 1)
  assert.equal(result.period_flows.total.became_overdue, 1)
})

test('进入逾期当天暂停不回溯到前一天，无日志明确暂停日期可补全暂停事件', async () => {
  const rows = [record({ status: 3, is_paused: true, pause_date: '2026-09-05' })]
  const logs = transition('task', 1, 'pause-late', 1, 3, '2026-09-05 16:00:00+08', 'suspend_date', '2026-09-05')
  const result = await analyze(rows, logs, { analysis_period: period('2026-09-05') })
  assert.equal(result.period_flows.total.became_overdue, 1)
  const withoutHistory = await analyze(rows, [], { analysis_period: period('2026-09-05') })
  assert.equal(withoutHistory.period_flows.total.paused, 1)
})
