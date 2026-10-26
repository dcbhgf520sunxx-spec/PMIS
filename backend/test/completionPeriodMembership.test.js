const test = require('node:test')
const assert = require('node:assert/strict')
const { evaluateCompletion, statusAt } = require('../src/services/mcpCompletionAnalysisService')
const { buildHistories } = require('../src/services/mcpPeriodAnalysisService')

const types = ['requirement', 'project', 'stage_plan', 'task', 'bug', 'work_order']
const period = { start_date: '2026-11-01', end_date: '2026-11-30' }
const today = '2026-11-15'
const doneStatus = type => type === 'requirement' ? 33 : 2
const activeStatus = type => type === 'requirement' ? 31 : type === 'bug' ? 3 : 1
function record(type, changes = {}) {
  return { business_type: type, id: 1, name: '归期回归样例', owner_id: 8, owner_ids: [8],
    requirement_type: 4, status: doneStatus(type), plan_date: '2026-10-08', actual_date: '2026-10-08',
    created_date: '2026-09-01', created_at: '2026-09-01T09:00:00+08:00', ...changes }
}
function change(type, from, to, at, id, businessDate) {
  const log = { business_type: type, target_id: 1, action: '状态变更', field_name: 'status',
    old_value: String(from), new_value: String(to), created_at: at, log_id: id, operation_id: `op-${id}` }
  const field = type === 'bug' ? 'closed_date' : type === 'work_order' ? 'resolve_date' : 'actual_end_date'
  return businessDate ? [log, { ...log, field_name: field, old_value: null, new_value: businessDate, log_id: id + 1 }] : [log]
}
function history(type) {
  return [...change(type, type === 'requirement' ? 30 : 0, type === 'requirement' ? 31 : 1, '2026-10-09T09:00:00+08:00', 1),
    ...change(type, type === 'requirement' ? 31 : 1, doneStatus(type), '2026-10-09T09:01:00+08:00', 2, '2026-10-08')]
}
function evaluate(records, logs, options = {}) {
  return evaluateCompletion({ records, logs, people: [{ id: 8, name: '测试人员' }],
    types: [...new Set(records.map(r => r.business_type))], period, today, cutoff: today, ...options })
}

for (const type of types) {
  test(`${type}：补录的完成日期早于前一步操作时间，期初仍应还原为已完成`, () => {
    const r = record(type), logs = history(type)
    const histories = buildHistories([r], logs)
    assert.equal(statusAt(r, '2026-10-31', histories.get(`${type}:1`), today).status, doneStatus(type))
    const result = evaluate([r], logs)
    assert.equal(result.details[0].included, false)
    assert.equal(result.results[0].statistic_count, 0)
  })
  test(`${type}：期前已完成，计划日期落在本期也不能重复纳入`, () => {
    const r = record(type, { plan_date: type === 'bug' ? null : '2026-11-10' })
    const result = evaluate([r], history(type))
    assert.equal(result.details[0].included, false)
    assert.equal(result.results[0].completed_count, 0)
  })
  test(`${type}：本期录入但补填期前完成，初次处理或激活不能误当成完成后的重开`, () => {
    const r = record(type, { plan_date: '2026-11-10', actual_date: '2026-10-31' })
    const active = activeStatus(type)
    const logs = [...change(type, type === 'requirement' ? 30 : 0, active, '2026-11-02T09:00:00+08:00', 1),
      ...change(type, active, doneStatus(type), '2026-11-03T09:00:00+08:00', 2, '2026-10-31')]
    assert.equal(evaluate([r], logs).details[0].included, false)
  })
  test(`${type}：期前完成后本期重新打开并再次完成，保留本期工作`, () => {
    const r = record(type, { actual_date: '2026-11-05' })
    const logs = [...history(type),
      ...change(type, doneStatus(type), activeStatus(type), '2026-11-03T09:00:00+08:00', 4),
      ...change(type, activeStatus(type), doneStatus(type), '2026-11-06T09:00:00+08:00', 5, '2026-11-05')]
    const result = evaluate([r], logs)
    assert.equal(result.details[0].included, true)
    assert.equal(result.details[0].completed, true)
    assert.equal(result.results[0].statistic_count, 1)
    assert.equal(result.results[0].completed_count, 1)
  })
}

test('补录后仍按历史观察日判断，期末之后的重新打开不改变此前完成状态', () => {
  const r = record('task', { status: 1, actual_date: null })
  const logs = [...history('task'), ...change('task', 2, 1, '2026-11-03T09:00:00+08:00', 4)]
  const histories = buildHistories([r], logs)
  assert.equal(statusAt(r, '2026-10-31', histories.get('task:1'), today).status, 2)
  const result = evaluate([r], logs, { period: { start_date: '2026-10-01', end_date: '2026-10-31' }, cutoff: '2026-10-31' })
  assert.equal(result.details[0].completed, true)
})

test('主任务依子任务判断：子任务本期重新打开并完成，主任务不能按期前完成排除', () => {
  const parent = record('task', { status: 1, actual_date: null })
  const child = record('task', { id: 2, parent_task_id: 1, owner_id: 9, owner_ids: [9], actual_date: '2026-11-05' })
  const logs = [...history('task'), ...change('task', 2, 1, '2026-11-03T09:00:00+08:00', 4),
    ...change('task', 1, 2, '2026-11-06T09:00:00+08:00', 5, '2026-11-05')].map(log => ({ ...log, target_id: 2 }))
  logs.push(...change('task', 0, 1, '2026-09-02T09:00:00+08:00', 10))
  const detail = evaluate([parent, child], logs).details.find(d => d.record_id === 1)
  assert.equal(detail.included, true)
  assert.equal(detail.completed, true)
})

test('主任务不因已取消关闭子任务的重开记录重复纳入，仍只汇总有效子任务', () => {
  const parent = record('task', { status: 1, actual_date: null })
  const children = [2, 3].map(id => record('task', { id, parent_task_id: 1, owner_id: 9, owner_ids: [9] }))
  children[1] = { ...children[1], status: 4, close_date: '2026-11-03', actual_date: null }
  const logs = [2, 3].flatMap(id => history('task').map(log => ({ ...log, target_id: id })))
  logs.push(...change('task', 0, 1, '2026-09-02T09:00:00+08:00', 10),
    ...change('task', 2, 1, '2026-11-02T09:00:00+08:00', 4).map(log => ({ ...log, target_id: 3 })),
    ...change('task', 1, 4, '2026-11-03T09:00:00+08:00', 5).map(log => ({ ...log, target_id: 3 })))
  const detail = evaluate([parent, ...children], logs).details.find(d => d.record_id === 1)
  assert.equal(detail.completed, true)
  assert.equal(detail.included, false)
})

test('有效子任务均在期前完成，父任务自身暂停或恢复不算本期重新完成', () => {
  for (const paused of [true, false]) {
    const parent = record('task', { status: paused ? 3 : 1, actual_date: null, pause_date: paused ? '2026-11-02' : null })
    const child = record('task', { id: 2, parent_task_id: 1, owner_id: 9, owner_ids: [9] })
    const logs = [...history('task').map(log => ({ ...log, target_id: 2 })),
      ...change('task', 0, 1, '2026-09-02T09:00:00+08:00', 10),
      ...change('task', 1, 3, '2026-11-02T09:00:00+08:00', 11)]
    if (!paused) logs.push(...change('task', 3, 1, '2026-11-03T09:00:00+08:00', 12))
    const detail = evaluate([parent, child], logs).details.find(d => d.record_id === 1)
    assert.equal(detail.completed, true)
    assert.equal(detail.included, false)
  }
})

test('期初已完成的主任务本期新增资料不足的子任务，不能直接排除为旧完成', () => {
  const parent = record('task', { status: 1, actual_date: null })
  const oldChild = record('task', { id: 2, parent_task_id: 1, owner_id: 9, owner_ids: [9] })
  const unknownChild = record('task', { id: 3, parent_task_id: 1, owner_id: 9, owner_ids: [9],
    status: 1, actual_date: null, project_id: 999, created_date: '2026-11-02', created_at: '2026-11-02T09:00:00+08:00' })
  const logs = [...history('task').map(log => ({ ...log, target_id: 2 })),
    ...change('task', 0, 1, '2026-09-02T09:00:00+08:00', 10)]
  const detail = evaluate([parent, oldChild, unknownChild], logs).details.find(d => d.record_id === 1)
  assert.equal(detail.completed, null)
  assert.equal(detail.included, null)
})

test('需求在期前得出有效结论，本期只是后续实施或暂停，不重复算新一轮完成', () => {
  const r = record('requirement', { requirement_type: 1, status: 35, actual_date: null, plan_date: '2026-11-10' })
  const logs = [...change('requirement', 1, 2, '2026-10-10T09:00:00+08:00', 1),
    ...change('requirement', 2, 31, '2026-11-02T09:00:00+08:00', 2),
    ...change('requirement', 31, 35, '2026-11-03T09:00:00+08:00', 3)]
  assert.equal(evaluate([r], logs).details[0].included, false)
})

test('个人全景六类明细、概览、关系图及简报同步排除期前完成，保留本期计划和遗留', () => {
  const { buildPersonalSnapshot } = require('../src/services/digitalTwinPersonalService')
  const { buildPersonalPeriodSnapshot, resolvePersonalPeriod } = require('../src/services/digitalTwinPersonalPeriod')
  const { buildPersonalSummaryEvidence } = require('../src/services/digitalTwinAiSummary')
  const kinds = { requirement: 'requirements', project: 'projects', stage_plan: 'planItems', task: 'tasks', bug: 'bugs', work_order: 'orders' }
  const records = types.map(type => record(type, { plan_date: '2026-11-10' }))
  const logs = types.flatMap(history)
  records.push(record('task', { id: 2, created_date: '2026-11-01', created_at: '2026-11-01T09:00:00+08:00', plan_date: '2026-11-14', actual_date: '2026-11-14' }),
    record('task', { id: 3, status: 1, actual_date: null }))
  logs.push(...change('task', 0, 1, '2026-10-09T09:00:00+08:00', 10).map(log => ({ ...log, target_id: 3 })))
  const data = Object.fromEntries(types.map(type => [kinds[type], records.filter(r => r.business_type === type).map(r => ({
    ...r, title: r.name, problem_desc: r.name, expected_end_date: r.plan_date, current_due_date: r.plan_date,
    expected_resolve_date: r.plan_date, actual_end_date: r.actual_date, relationship: 'responsible',
  }))]))
  const paths = new Set(['/products', '/requirements', '/projects', '/tasks', '/bugs', '/work-orders'])
  const raw = buildPersonalSnapshot({ id: 8, real_name: '测试人员' }, data, paths, '2026-11-15 10:00:00')
  const range = resolvePersonalPeriod({ startDate: period.start_date, endDate: period.end_date }, new Date('2026-11-15T02:00:00Z'))
  const snapshot = buildPersonalPeriodSnapshot(raw, { records, logs }, range)
  assert.deepEqual(snapshot.records.map(r => `${r.kind}:${r.id}`).sort(), ['tasks:2', 'tasks:3'])
  assert.equal(snapshot.overview.responsible, 2)
  assert.equal(snapshot.overview.open, 1)
  for (const group of snapshot.groups) {
    assert.equal(group.completion.included, group.kind === 'tasks' ? 2 : 0)
    assert.equal(group.completion.completed, group.kind === 'tasks' ? 1 : 0)
  }
  assert.ok(snapshot.priorities.every(r => r.id !== '1'))
  assert.deepEqual(buildPersonalSummaryEvidence(snapshot).work.map(r => r.sourceId).sort(), ['tasks:2', 'tasks:3'])
  assert.equal(snapshot.nodes.find(n => n.kind === 'tasks').value, '2')
})
