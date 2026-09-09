const assert = require('node:assert/strict')
const test = require('node:test')
const { AjvJsonSchemaValidator } = require('@modelcontextprotocol/sdk/validation/ajv')
const { filterToolsForContext } = require('../src/mcp/catalog')
const { analyzeBusinessPeriod } = require('../src/services/mcpPeriodAnalysisService')

const NOW = new Date('2026-09-08T02:00:00Z')
const ALL_MENUS = new Set(['/projects', '/requirements', '/tasks', '/bugs', '/work-orders'])
const ALL_TYPES = ['project', 'requirement', 'stage_plan', 'task', 'bug', 'work_order']
const ALL_SECTIONS = [
  'period_flows', 'current_stock', 'plan_outlook', 'comparison', 'trend', 'groupings',
  'quality_and_delivery', 'financials', 'flow_candidates', 'risk_candidates', 'report_people',
]
const COMMON_KEYS = ['coverage', 'data_cutoff', 'resolved_periods']
const period = (start, end = start) => ({ preset: 'custom', start_date: start, end_date: end })

const DEFAULT_STATUS = {
  project: 1, requirement: 31, stage_plan: 1, task: 1, bug: 0, work_order: 1,
}
let nextLogId = 1

function record(businessType, id, values = {}) {
  const ownerId = values.owner_id ?? 8
  const creatorId = values.creator_id ?? ownerId
  const updaterId = values.updater_id ?? creatorId
  const businessRoleIds = values.business_role_ids || [ownerId]
  const personIds = values.person_ids || [...new Set([...businessRoleIds, creatorId, updaterId])]
  return {
    business_type: businessType,
    id,
    name: `${businessType}-${id}`,
    status: DEFAULT_STATUS[businessType],
    priority: 1,
    product_id: 10,
    product_name: '通用产品',
    project_id: businessType === 'project' ? id : 20,
    project_name: '通用项目',
    requirement_id: businessType === 'requirement' ? id : null,
    requirement_name: null,
    owner_id: ownerId,
    owner_name: `人员${ownerId}`,
    owner_ids: businessRoleIds,
    business_role_ids: businessRoleIds,
    person_ids: personIds,
    person_names: personIds.map((personId) => `人员${personId}`),
    creator_id: creatorId,
    updater_id: updaterId,
    parent_task_id: null,
    plan_date: null,
    actual_date: null,
    resolved_date: null,
    pause_date: null,
    created_at: '2026-08-31 09:00:00+08',
    is_completed: false,
    is_paused: false,
    is_overdue: 0,
    parent_project_paused: false,
    required_delivery: false,
    delivery_count: 0,
    ...values,
  }
}

function fieldLog(businessType, targetId, operationId, fieldName, oldValue, newValue, recordedAt, operatorId = 14) {
  return {
    business_type: businessType,
    target_id: targetId,
    log_id: nextLogId++,
    operation_id: operationId,
    operator_id: operatorId,
    action: '编辑',
    field_name: fieldName,
    old_value: oldValue,
    new_value: newValue,
    created_at: `${recordedAt} 10:00:00+08`,
  }
}

function completionLogs(businessType, targetId, operationId, oldStatus, newStatus, dateField, date, operatorId = 14) {
  return [
    fieldLog(businessType, targetId, operationId, 'status', oldStatus, newStatus, date, operatorId),
    fieldLog(businessType, targetId, operationId, dateField, null, date, date, operatorId),
  ]
}

function fixture(rows, logs = [], users = []) {
  const state = { rows, logs, users, failRecords: false, queriedTypes: [] }
  state.database = {
    prepare(sql) {
      const businessType = /period_analysis:records:([a-z_]+)/.exec(sql)?.[1]
      if (businessType) {
        state.queriedTypes.push(businessType)
        return { all: async () => {
          if (state.failRecords) throw new Error('fixture storage unavailable')
          return state.rows.filter((item) => item.business_type === businessType)
        } }
      }
      if (/period_analysis:logs/.test(sql)) return { all: async () => state.logs }
      if (/period_analysis:(people|report_people)/.test(sql)) {
        return { all: async (...ids) => {
          const selected = new Set(ids.flat().map(Number))
          return state.users.filter((user) => selected.has(Number(user.id)))
        } }
      }
      if (/period_analysis:financials/.test(sql)) {
        return { get: async () => ({
          contract_count: 1,
          contract_amount: 100000,
          planned_payment_amount: 60000,
          actual_payment_amount: 40000,
          unpaid_amount: 20000,
          period_contract_count: 1,
          period_contract_amount: 100000,
          period_actual_payment_amount: 40000,
          plan_period_payment_amount: 10000,
        }) }
      }
      throw new Error(`Unexpected query in manual fixture: ${sql}`)
    },
  }
  return state
}

function analyze(data, args, context = { user: { id: 8 }, allowedMenuPaths: ALL_MENUS }, now = NOW) {
  return analyzeBusinessPeriod(args, context, data.database, now)
}

test('sections保持旧调用完整兼容，只返回选中块且不改变明细分页', async () => {
  const data = fixture([
    record('task', 1, { plan_date: '2026-09-08', creator_id: 9, updater_id: 9, person_ids: [8, 9], person_names: ['本人', '创建人'] }),
    record('task', 2, { plan_date: '2026-09-09', creator_id: 9, updater_id: 9, person_ids: [8, 9], person_names: ['本人', '创建人'] }),
  ], [], [
    { id: 8, name: '本人', status: 1, is_deleted: 0 },
    { id: 9, name: '创建人', status: 1, is_deleted: 0 },
  ])
  const args = {
    analysis_period: period('2026-09-01', '2026-09-08'),
    plan_period: period('2026-09-08', '2026-09-09'),
    risk_period: period('2026-09-08', '2026-09-09'),
    comparison_period: period('2026-08-24', '2026-08-31'),
    business_types: ['task'],
    trend_granularity: 'day',
    group_by: ['business_type'],
  }

  const legacy = await analyze(data, args)
  const explicitAll = await analyze(data, { ...args, sections: ALL_SECTIONS })
  assert.deepEqual(Object.keys(legacy).sort(), [...COMMON_KEYS, ...ALL_SECTIONS].sort())
  assert.equal(Object.hasOwn(legacy.coverage, 'requested_sections'), false)
  assert.deepEqual(explicitAll.coverage.requested_sections, ALL_SECTIONS)
  for (const section of ALL_SECTIONS) assert.deepEqual(explicitAll[section], legacy[section])

  const selected = await analyze(data, { ...args, sections: ['period_flows', 'current_stock', 'risk_candidates'] })
  assert.deepEqual(Object.keys(selected).sort(), [...COMMON_KEYS, 'current_stock', 'period_flows', 'risk_candidates'].sort())
  for (const section of ['period_flows', 'current_stock', 'risk_candidates']) {
    assert.deepEqual(selected[section], legacy[section])
  }

  const detailArgs = { ...args, detail_query: { source: 'people', page: 1, page_size: 1 } }
  const detail = await analyze(data, detailArgs)
  const detailWithSections = await analyze(data, { ...detailArgs, sections: ['financials'] })
  assert.deepEqual(detailWithSections, detail)
  assert.deepEqual(Object.keys(detailWithSections).sort(), [...COMMON_KEYS, 'details'].sort())
  await assert.rejects(analyze(data, { ...args, sections: ['management_weekly_report'] }),
    (error) => error.code === 'MCP_ARGUMENT_INVALID' && Boolean(error.fieldErrors.sections))
})

test('管理分析用通用周期组合覆盖六类去重、计划分子分母、BUG修复关闭和人员续页', async () => {
  const owners = [8, 9, 10, 11, 12, 13]
  const users = [...owners, 14].map((id) => ({ id, name: `人员${id}`, status: 1, is_deleted: 0 }))
  const rows = [
    record('project', 1, { owner_id: 8, creator_id: 14, updater_id: 14, person_ids: [8, 14], person_names: ['人员8', '人员14'],
      status: 2, plan_date: '2026-09-06', actual_date: '2026-09-05', is_completed: true }),
    record('requirement', 1, { owner_id: 9, creator_id: 14, updater_id: 14, person_ids: [9, 14], person_names: ['人员9', '人员14'], plan_date: '2026-12-01' }),
    record('stage_plan', 1, { owner_id: 10, creator_id: 14, updater_id: 14, person_ids: [10, 14], person_names: ['人员10', '人员14'], plan_date: '2026-09-03' }),
    record('task', 1, { owner_id: 11, creator_id: 14, updater_id: 14, person_ids: [11, 14], person_names: ['人员11', '人员14'],
      status: 2, plan_date: '2026-09-04', actual_date: '2026-09-04', is_completed: true }),
    record('bug', 1, { owner_id: 12, creator_id: 14, updater_id: 14, person_ids: [12, 14], person_names: ['人员12', '人员14'],
      status: 2, actual_date: '2026-09-05', resolved_date: '2026-09-03', is_completed: true }),
    record('work_order', 1, { owner_id: 13, creator_id: 14, updater_id: 14, person_ids: [13, 14], person_names: ['人员13', '人员14'],
      status: 5, plan_date: '2026-09-10' }),
  ]
  const logs = [
    ...completionLogs('project', 1, 'project-complete', 1, 2, 'actual_end_date', '2026-09-05'),
    ...completionLogs('task', 1, 'task-complete', 1, 2, 'actual_end_date', '2026-09-04'),
    ...completionLogs('bug', 1, 'bug-fixed', 0, 1, 'resolved_date', '2026-09-03'),
    ...completionLogs('bug', 1, 'bug-closed', 1, 2, 'closed_date', '2026-09-05'),
    fieldLog('work_order', 1, 'work-order-activated', 'status', 1, 5, '2026-09-07'),
  ]
  const data = fixture(rows, logs, users)

  const annual = await analyze(data, {
    analysis_period: period('2026-01-01', '2026-09-06'),
    plan_period: period('2026-01-01', '2026-12-31'),
    completion_cutoff: '2026-09-06',
    business_types: ALL_TYPES,
  })
  assert.equal(annual.period_flows.total.created, 6)
  assert.equal(annual.period_flows.total.activated, 0)
  assert.equal(Object.values(annual.period_flows.by_business_type).reduce((sum, item) => sum + item.created, 0), 6)
  assert.deepEqual(annual.plan_outlook.total, { planned: 5, completed: 2, pending: 3 })
  assert.deepEqual([annual.plan_outlook.total.completed, annual.plan_outlook.total.planned], [2, 5])
  assert.equal(annual.period_flows.total.fixed, 1)
  assert.deepEqual({
    fixed: annual.period_flows.by_business_type.bug.fixed,
    closed: annual.period_flows.by_business_type.bug.completed,
  }, { fixed: 1, closed: 1 })
  assert.equal(annual.quality_and_delivery.bug_fixed, 1)
  assert.equal(annual.quality_and_delivery.bug_closed, 1)

  const reportWeek = await analyze(data, {
    analysis_period: { preset: 'week', anchor_date: '2026-09-04' },
    plan_period: period('2026-08-31', '2026-09-06'),
    completion_cutoff: '2026-09-06',
    business_types: ALL_TYPES,
  })
  assert.deepEqual(reportWeek.resolved_periods.analysis_period, { preset: 'week', start_date: '2026-08-31', end_date: '2026-09-06' })
  assert.deepEqual({
    created: reportWeek.period_flows.total.created,
    completed: reportWeek.period_flows.total.completed,
    fixed: reportWeek.period_flows.total.fixed,
  }, { created: 6, completed: 3, fixed: 1 })
  assert.deepEqual(reportWeek.plan_outlook.total, { planned: 3, completed: 2, pending: 1 })

  const nextWeek = await analyze(data, {
    analysis_period: period('2026-08-31', '2026-09-06'),
    plan_period: period('2026-09-07', '2026-09-13'),
    risk_period: period('2026-09-07', '2026-09-09'),
    business_types: ALL_TYPES,
  })
  assert.deepEqual(nextWeek.plan_outlook.total, { planned: 1, completed: 0, pending: 1 })
  assert.equal(nextWeek.risk_candidates.due_soon.total, 0)

  const people = []
  let datasetToken
  for (let page = 1; page <= 3; page += 1) {
    const result = await analyze(data, {
      analysis_period: period('2026-01-01', '2026-09-06'),
      plan_period: period('2026-01-01', '2026-12-31'),
      completion_cutoff: '2026-09-06',
      business_types: ALL_TYPES,
      detail_query: { source: 'people', page, page_size: 3, ...(datasetToken ? { dataset_token: datasetToken } : {}) },
    })
    datasetToken = result.details.datasetToken
    people.push(...result.details.items.map((person) => person.user_id))
  }
  assert.deepEqual(people, [8, 9, 10, 11, 12, 13, 14])
})

test('全局每日组合独立解析上一工作日、今日计划和三天风险，正常存量及暂停项目事项不遗漏不误报', async () => {
  const data = fixture([
    record('task', 21, { name: '上周五完成', status: 2, actual_date: '2026-09-04', is_completed: true }),
    record('task', 22, { name: '正常无计划事项' }),
    record('task', 23, { name: '远期正常事项', plan_date: '2026-09-30' }),
    record('task', 24, { name: '今日计划', plan_date: '2026-09-07' }),
    record('task', 25, { name: '三天内风险', plan_date: '2026-09-09' }),
    record('stage_plan', 26, { name: '暂停项目内事项', plan_date: '2026-09-01', parent_project_paused: true }),
  ], completionLogs('task', 21, 'friday-complete', 1, 2, 'actual_end_date', '2026-09-04'), [
    { id: 8, name: '人员8', status: 1, is_deleted: 0 },
    { id: 14, name: '人员14', status: 1, is_deleted: 0 },
  ])
  const result = await analyze(data, {
    analysis_period: { preset: 'workday', anchor_date: '2026-09-07', offset: -1 },
    plan_period: { preset: 'day', anchor_date: '2026-09-07' },
    risk_period: period('2026-09-07', '2026-09-09'),
    business_types: ['task', 'stage_plan'],
  }, { user: { id: 8 }, allowedMenuPaths: new Set(['/tasks', '/projects']) }, new Date('2026-09-07T02:00:00Z'))

  assert.deepEqual(result.resolved_periods.analysis_period, { preset: 'workday', start_date: '2026-09-04', end_date: '2026-09-04' })
  assert.equal(result.period_flows.total.completed, 1)
  assert.deepEqual(result.plan_outlook.total, { planned: 1, completed: 0, pending: 1 })
  assert.equal(result.risk_candidates.due_soon.total, 2)
  assert.equal(result.current_stock.total.total, 6)
  assert.equal(result.current_stock.total.unfinished, 5)
  assert.deepEqual(result.risk_candidates.overdue.items.map((item) => item.target_id), [])
  assert.ok(result.risk_candidates.missing_plan_date.items.some((item) => item.target_id === 22))
})

test('个人每日business_role范围包含正常事项、子任务、协作事项、指派BUG和跟进工单，并排除他人事项', async () => {
  const data = fixture([
    record('task', 31, { name: '本人无计划任务' }),
    record('task', 32, { name: '本人远期任务', plan_date: '2026-10-01' }),
    record('task', 33, { name: '本人子任务', parent_task_id: 32 }),
    record('stage_plan', 34, { name: '本人协作关键事项', owner_id: 9, owner_ids: [9, 8], business_role_ids: [9, 8],
      person_ids: [9, 8], person_names: ['他人', '本人'] }),
    record('bug', 35, { name: '指派给本人的BUG' }),
    record('work_order', 36, { name: '本人跟进工单' }),
    record('task', 37, { name: '纯他人事项', owner_id: 9, owner_ids: [9], business_role_ids: [9],
      person_ids: [9], person_names: ['他人'], creator_id: 9, updater_id: 9 }),
  ], [], [
    { id: 8, name: '本人', status: 1, is_deleted: 0 },
    { id: 9, name: '他人', status: 1, is_deleted: 0 },
  ])
  const args = {
    analysis_period: { preset: 'day', anchor_date: '2026-09-08' },
    business_types: ['task', 'stage_plan', 'bug', 'work_order'],
    filters: { person_scope: 'self', person_relation: 'business_role' },
  }
  const summary = await analyze(data, args)
  assert.equal(summary.current_stock.total.total, 6)
  const details = await analyze(data, { ...args, detail_query: { source: 'stock', metric: 'total', page_size: 20 } })
  assert.deepEqual(details.details.items.map((item) => `${item.business_type}:${item.target_id}`), [
    'bug:35', 'stage_plan:34', 'task:31', 'task:32', 'task:33', 'work_order:36',
  ])
  assert.equal(details.details.items.find((item) => item.target_id === 33).parent_task_id, 32)
  assert.ok(!details.details.items.some((item) => item.target_id === 37))
})

test('跨月单业务created可最小选择输出；无权限从目录拒绝，数据失败以不完整披露而非可信零', async () => {
  const data = fixture([record('task', 41, { created_at: '2026-05-01 09:00:00+08' })], [], [
    { id: 8, name: '人员8', status: 1, is_deleted: 0 },
  ])
  const result = await analyze(data, {
    analysis_period: period('2026-04-28', '2026-05-03'),
    business_types: ['task'],
    metrics: ['created'],
    sections: ['period_flows'],
  }, { user: { id: 8 }, allowedMenuPaths: new Set(['/tasks']) }, new Date('2026-05-03T02:00:00Z'))
  assert.deepEqual(Object.keys(result).sort(), [...COMMON_KEYS, 'period_flows'].sort())
  assert.deepEqual(result.period_flows.total, { created: 1 })
  assert.deepEqual([...new Set(data.queriedTypes)], ['task'])

  const validator = new AjvJsonSchemaValidator()
  const taskOnlyTool = filterToolsForContext({ endpointType: 'query', allowedMenuPaths: new Set(['/tasks']) })
    .find((tool) => tool.name === 'business_period_analysis')
  const inputValid = validator.getValidator(taskOnlyTool.inputSchema)
  assert.equal(inputValid({
    analysis_period: period('2026-04-28', '2026-05-03'), business_types: ['project'], sections: ['period_flows'],
  }).valid, false)
  assert.equal(filterToolsForContext({ endpointType: 'query', allowedMenuPaths: new Set() })
    .some((tool) => tool.name === 'business_period_analysis'), false)

  const unavailable = fixture([record('task', 42)])
  unavailable.failRecords = true
  const incomplete = await analyze(unavailable, {
    analysis_period: period('2026-04-28', '2026-05-03'),
    business_types: ['task'],
    sections: ['current_stock'],
  }, { user: { id: 8 }, allowedMenuPaths: new Set(['/tasks']) }, new Date('2026-05-03T02:00:00Z'))
  assert.equal(incomplete.current_stock.total.total, 0)
  assert.equal(incomplete.coverage.component_completeness.current_stock, false)
  assert.equal(incomplete.coverage.statistics_complete, false)
  assert.match(incomplete.coverage.notes.join('\n'), /不完整/)
})
