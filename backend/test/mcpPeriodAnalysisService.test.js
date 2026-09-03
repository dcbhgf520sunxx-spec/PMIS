const assert = require('node:assert/strict')
const test = require('node:test')

const {
  analyzeBusinessPeriod,
  resolvePeriod,
} = require('../src/services/mcpPeriodAnalysisService')
const { dispatchQueryTool } = require('../src/mcp/queryTools')

test('自然周按周一到周日解析', () => {
  assert.deepEqual(resolvePeriod({ preset: 'week', anchor_date: '2026-09-02' }), {
    preset: 'week',
    start_date: '2026-08-31',
    end_date: '2026-09-06',
  })
})

test('上一工作日在周一回退到上周五', () => {
  assert.deepEqual(resolvePeriod({
    preset: 'workday',
    anchor_date: '2026-08-31',
    offset: -1,
  }), {
    preset: 'workday',
    start_date: '2026-08-28',
    end_date: '2026-08-28',
  })
})

test('月季度和年度偏移跨年仍返回完整自然区间', () => {
  assert.deepEqual(resolvePeriod({ preset: 'month', anchor_date: '2026-01-15', offset: -1 }), {
    preset: 'month', start_date: '2025-12-01', end_date: '2025-12-31',
  })
  assert.deepEqual(resolvePeriod({ preset: 'quarter', anchor_date: '2026-01-15', offset: -1 }), {
    preset: 'quarter', start_date: '2025-10-01', end_date: '2025-12-31',
  })
  assert.deepEqual(resolvePeriod({ preset: 'year', anchor_date: '2026-01-15', offset: -1 }), {
    preset: 'year', start_date: '2025-01-01', end_date: '2025-12-31',
  })
})

test('自定义区间原样解析并拒绝非法或反向日期', () => {
  assert.deepEqual(resolvePeriod({
    preset: 'custom', start_date: '2024-02-29', end_date: '2024-03-02',
  }), {
    preset: 'custom', start_date: '2024-02-29', end_date: '2024-03-02',
  })
  assert.throws(
    () => resolvePeriod({ preset: 'custom', start_date: '2026-02-30', end_date: '2026-03-01' }),
    (error) => error.code === 'MCP_ARGUMENT_INVALID' && Boolean(error.fieldErrors.analysis_period)
  )
  assert.throws(
    () => resolvePeriod({ preset: 'custom', start_date: '2026-09-02', end_date: '2026-09-01' }),
    (error) => error.code === 'MCP_ARGUMENT_INVALID' && Boolean(error.fieldErrors.analysis_period)
  )
})

function analysisDatabase() {
  const records = {
    project: [{
      business_type: 'project', id: 1, name: '项目收尾', status: 2, priority: 2,
      product_id: 10, product_name: '产品A', project_id: 1, project_name: '项目收尾',
      owner_id: 8, owner_name: '孙鑫鑫', plan_date: '2026-08-31', actual_date: '2026-09-01',
      created_at: '2026-08-20T01:00:00.000Z', is_overdue: 0, is_paused: false,
      is_completed: true, required_delivery: false, delivery_count: 0,
    }],
    stage_plan: [],
    task: [{
      business_type: 'task', id: 2, name: '逾期任务', status: 1, priority: 2,
      project_id: 1, project_name: '项目收尾', owner_id: 9, owner_name: '李东',
      person_ids: [9, 99], person_names: ['李东', '创建人'],
      plan_date: '2026-08-31', actual_date: null, created_at: '2026-08-31T02:00:00.000Z',
      is_overdue: 1, is_paused: false, is_completed: false,
      required_delivery: false, delivery_count: 0,
    }],
    bug: [{
      business_type: 'bug', id: 3, name: '知识库缺陷', status: 2, priority: 3,
      project_id: 1, project_name: '项目收尾', owner_id: 10, owner_name: '李佳龙',
      plan_date: null, actual_date: '2026-08-31', created_at: '2026-08-31T03:00:00.000Z',
      is_overdue: 0, is_paused: false, is_completed: true,
      required_delivery: false, delivery_count: 0,
    }],
  }
  const logs = [
    { business_type: 'project', target_id: 1, operation_id: 'p1', field_name: 'status', old_value: '1', new_value: '2', created_at: '2026-08-31T08:00:00.000Z' },
    { business_type: 'project', target_id: 1, operation_id: 'p1', field_name: 'actual_end_date', old_value: '', new_value: '2026-08-31', created_at: '2026-08-31T08:00:00.000Z' },
    { business_type: 'project', target_id: 1, operation_id: 'p2', field_name: 'status', old_value: '1', new_value: '2', created_at: '2026-09-01T08:00:00.000Z' },
    { business_type: 'project', target_id: 1, operation_id: 'p2', field_name: 'actual_end_date', old_value: '', new_value: '2026-09-01', created_at: '2026-09-01T08:00:00.000Z' },
    { business_type: 'project', target_id: 1, field_name: 'member_ids', old_value: '8', new_value: '8,9', created_at: '2026-08-31T08:30:00.000Z' },
    { business_type: 'task', target_id: 2, field_name: 'priority', old_value: '1', new_value: '2', created_at: '2026-08-31T09:00:00.000Z' },
    { business_type: 'bug', target_id: 3, field_name: 'status', old_value: '0', new_value: '1', created_at: '2026-08-31T10:00:00.000Z' },
    { business_type: 'bug', target_id: 3, field_name: 'status', old_value: '1', new_value: '2', created_at: '2026-08-31T11:00:00.000Z' },
  ]
  return {
    prepare(sql) {
      const recordMatch = /period_analysis:records:([a-z_]+)/.exec(sql)
      if (recordMatch) return { all: async () => records[recordMatch[1]] || [] }
      if (/period_analysis:logs/.test(sql)) return { all: async () => logs }
      if (/period_analysis:financials/.test(sql)) {
        return {
          get: async () => ({
            contract_count: 1,
            contract_amount: '100000.00',
            planned_payment_amount: '60000.00',
            actual_payment_amount: '40000.00',
            unpaid_amount: '20000.00',
          }),
        }
      }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }
}

test('任意周期分析汇总真实流量、当前存量、计划、趋势和风险候选', async () => {
  const result = await analyzeBusinessPeriod({
    analysis_period: { preset: 'custom', start_date: '2026-08-31', end_date: '2026-09-01' },
    plan_period: { preset: 'day', anchor_date: '2026-08-31' },
    comparison_period: { preset: 'custom', start_date: '2026-08-29', end_date: '2026-08-30' },
    trend_granularity: 'day',
    detail_limit: 10,
  }, {
    allowedMenuPaths: new Set(['/projects', '/tasks', '/bugs']),
  }, analysisDatabase(), new Date('2026-09-02T09:00:00.000Z'))

  assert.equal(result.period_flows.total.created, 2)
  assert.equal(result.period_flows.total.completed, 2)
  assert.equal(result.period_flows.total.important_adjustments, 2)
  assert.equal(result.period_flows.total.became_overdue, 1)
  assert.equal(result.period_flows.total.new_overdue_unresolved, 1)
  assert.equal(result.period_flows.by_business_type.bug.fixed, 1)
  assert.equal(result.quality_and_delivery.on_time_completed, 1)
  assert.equal(result.quality_and_delivery.delayed_completed, 0)
  assert.equal(result.current_stock.total.unfinished, 1)
  assert.equal(result.current_stock.total.overdue, 1)
  assert.deepEqual(result.plan_outlook.total, { planned: 2, completed: 0, pending: 2 })
  assert.equal(result.trend.buckets.length, 2)
  assert.equal(result.trend.buckets.reduce((sum, bucket) => sum + bucket.period_flows.created, 0), 2)
  assert.deepEqual(result.comparison.metrics.created, {
    current: 2, comparison: 0, absolute_change: 2,
  })
  assert.equal(result.risk_candidates.overdue.total, 1)
  assert.equal(result.risk_candidates.overdue.has_more, false)
  assert.equal(result.financials.contract_amount, 100000)
  assert.equal(result.coverage.statistics_complete, true)
  assert.equal(result.coverage.historical_stock_supported, false)
})

test('计划统计排除区间开始前已完成事项并只统计区间内完成', async () => {
  const records = [
    {
      business_type: 'task', id: 41, name: '提前完成', status: 2, priority: 1,
      owner_id: 8, owner_name: '孙鑫鑫', owner_ids: [8], plan_date: '2026-09-03',
      actual_date: '2026-09-02', created_at: '2026-09-01 09:00:00+08', is_overdue: 0,
      is_paused: false, is_completed: true, parent_project_paused: false,
      required_delivery: false, delivery_count: 0,
    },
    {
      business_type: 'task', id: 42, name: '当日完成', status: 2, priority: 1,
      owner_id: 8, owner_name: '孙鑫鑫', owner_ids: [8], plan_date: '2026-09-03',
      actual_date: '2026-09-03', created_at: '2026-09-01 09:00:00+08', is_overdue: 0,
      is_paused: false, is_completed: true, parent_project_paused: false,
      required_delivery: false, delivery_count: 0,
    },
    {
      business_type: 'task', id: 43, name: '仍待完成', status: 1, priority: 1,
      owner_id: 8, owner_name: '孙鑫鑫', owner_ids: [8], plan_date: '2026-09-03',
      actual_date: null, created_at: '2026-09-01 09:00:00+08', is_overdue: 0,
      is_paused: false, is_completed: false, parent_project_paused: false,
      required_delivery: false, delivery_count: 0,
    },
  ]
  const database = {
    prepare(sql) {
      if (/period_analysis:records:task/.test(sql)) return { all: async () => records }
      if (/period_analysis:logs/.test(sql)) return { all: async () => [] }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }

  const result = await analyzeBusinessPeriod({
    analysis_period: { preset: 'day', anchor_date: '2026-09-03' },
    plan_period: { preset: 'day', anchor_date: '2026-09-03' },
    business_types: ['task'],
  }, { allowedMenuPaths: new Set(['/tasks']) }, database, new Date('2026-09-03T04:00:00Z'))

  assert.deepEqual(result.plan_outlook.total, { planned: 2, completed: 1, pending: 1 })
})

test('风险候选使用独立日期区间而不是固定未来七天', async () => {
  const records = [
    {
      business_type: 'task', id: 51, name: '三天内到期', status: 1, priority: 1,
      owner_id: 8, owner_name: '孙鑫鑫', owner_ids: [8], plan_date: '2026-09-05',
      actual_date: null, created_at: '2026-09-01 09:00:00+08', is_overdue: 0,
      is_paused: false, is_completed: false, parent_project_paused: false,
      required_delivery: false, delivery_count: 0,
    },
    {
      business_type: 'task', id: 52, name: '三天外到期', status: 1, priority: 1,
      owner_id: 8, owner_name: '孙鑫鑫', owner_ids: [8], plan_date: '2026-09-08',
      actual_date: null, created_at: '2026-09-01 09:00:00+08', is_overdue: 0,
      is_paused: false, is_completed: false, parent_project_paused: false,
      required_delivery: false, delivery_count: 0,
    },
  ]
  const database = {
    prepare(sql) {
      if (/period_analysis:records:task/.test(sql)) return { all: async () => records }
      if (/period_analysis:logs/.test(sql)) return { all: async () => [] }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }

  const result = await analyzeBusinessPeriod({
    analysis_period: { preset: 'day', anchor_date: '2026-09-03' },
    risk_period: { preset: 'custom', start_date: '2026-09-03', end_date: '2026-09-06' },
    business_types: ['task'],
  }, { allowedMenuPaths: new Set(['/tasks']) }, database, new Date('2026-09-03T04:00:00Z'))

  assert.deepEqual(result.resolved_periods.risk_period, {
    preset: 'custom', start_date: '2026-09-03', end_date: '2026-09-06',
  })
  assert.equal(result.risk_candidates.due_soon.total, 1)
  assert.equal(result.risk_candidates.due_soon.items[0].target_id, 51)
})

test('同一事项的多次重要调整只统计一次并返回变化候选', async () => {
  const record = {
    business_type: 'task', id: 61, name: '调整任务', status: 1, priority: 2,
    owner_id: 8, owner_name: '孙鑫鑫', owner_ids: [8], plan_date: '2026-09-10',
    actual_date: null, created_at: '2026-09-01 09:00:00+08', is_overdue: 0,
    is_paused: false, is_completed: false, parent_project_paused: false,
    required_delivery: false, delivery_count: 0,
  }
  const database = {
    prepare(sql) {
      if (/period_analysis:records:task/.test(sql)) return { all: async () => [record] }
      if (/period_analysis:logs/.test(sql)) return { all: async () => [
        { business_type: 'task', target_id: 61, operation_id: 'adjust-owner', field_name: 'owner_ids', old_value: '8', new_value: '9', created_at: '2026-09-03 09:00:00+08' },
        { business_type: 'task', target_id: 61, operation_id: 'adjust-date', field_name: 'expected_end_date', old_value: '2026-09-08', new_value: '2026-09-10', created_at: '2026-09-03 10:00:00+08' },
        { business_type: 'task', target_id: 61, operation_id: 'adjust-date', field_name: 'priority', old_value: '1', new_value: '2', created_at: '2026-09-03 10:00:00+08' },
      ] }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }

  const result = await analyzeBusinessPeriod({
    analysis_period: { preset: 'day', anchor_date: '2026-09-03' },
    business_types: ['task'],
    detail_limit: 10,
  }, { allowedMenuPaths: new Set(['/tasks']) }, database, new Date('2026-09-03T04:00:00Z'))

  assert.equal(result.period_flows.total.important_adjustments, 1)
  assert.equal(result.flow_candidates.important_adjustments.total, 1)
  assert.equal(result.flow_candidates.important_adjustments.has_more, false)
  assert.equal(result.flow_candidates.important_adjustments.items[0].target_id, 61)
  assert.equal(result.flow_candidates.important_adjustments.items[0].event_date, '2026-09-03')
  assert.equal(result.flow_candidates.important_adjustments.items[0].changes.length, 3)
})

test('统计只查询授权业务类型且候选限量不影响聚合总数', async () => {
  const result = await analyzeBusinessPeriod({
    analysis_period: { preset: 'day', anchor_date: '2026-09-01' },
    business_types: ['project', 'task', 'bug'],
    detail_limit: 0,
  }, {
    allowedMenuPaths: new Set(['/tasks']),
  }, analysisDatabase(), new Date('2026-09-02T09:00:00.000Z'))

  assert.deepEqual(result.coverage.authorized_business_types, ['task'])
  assert.deepEqual(result.coverage.excluded_business_types, ['project', 'bug'])
  assert.equal(result.current_stock.total.overdue, 1)
  assert.equal(result.risk_candidates.overdue.items.length, 0)
  assert.equal(result.risk_candidates.overdue.total, 1)
  assert.equal(result.risk_candidates.overdue.has_more, true)
  assert.equal(result.financials.available, false)
})

test('查询分发器把当前账号权限和数据库传给周期分析服务', async () => {
  const result = await dispatchQueryTool('business_period_analysis', {
    analysis_period: { preset: 'day', anchor_date: '2026-09-01' },
    business_types: ['task'],
  }, {
    allowedMenuPaths: new Set(['/tasks']),
  }, {
    database: analysisDatabase(),
    now: new Date('2026-09-02T09:00:00.000Z'),
  })

  assert.deepEqual(result.coverage.authorized_business_types, ['task'])
  assert.equal(result.current_stock.total.overdue, 1)
})

test('metrics 只裁剪流量指标且不影响存量和风险计算', async () => {
  const result = await analyzeBusinessPeriod({
    analysis_period: { preset: 'custom', start_date: '2026-08-31', end_date: '2026-09-01' },
    business_types: ['task', 'bug'],
    metrics: ['created', 'completed'],
    trend_granularity: 'day',
  }, {
    allowedMenuPaths: new Set(['/tasks', '/bugs']),
  }, analysisDatabase(), new Date('2026-09-02T09:00:00.000Z'))

  assert.deepEqual(Object.keys(result.period_flows.total), ['created', 'completed'])
  assert.deepEqual(Object.keys(result.trend.buckets[0].period_flows), ['created', 'completed'])
  assert.equal(result.current_stock.total.overdue, 1)
})

test('合同总额不会把相同金额的不同合同错误去重', async () => {
  let financialSql = ''
  const database = {
    prepare(sql) {
      if (/period_analysis:records:/.test(sql) || /period_analysis:logs/.test(sql)) return { all: async () => [] }
      if (/period_analysis:financials/.test(sql)) {
        financialSql = sql
        return { get: async () => ({}) }
      }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }

  await analyzeBusinessPeriod({
    analysis_period: { preset: 'day', anchor_date: '2026-09-01' },
    business_types: ['project'],
  }, { allowedMenuPaths: new Set(['/projects']) }, database)

  assert.match(financialSql, /SUM\(contract\.contract_amount\)/)
  assert.doesNotMatch(financialSql, /SUM\(DISTINCT contract\.contract_amount\)/)
})

test('创建时计划日已过的事项在创建日进入逾期', async () => {
  const database = {
    prepare(sql) {
      if (/period_analysis:records:task/.test(sql)) {
        return { all: async () => [{
          business_type: 'task', id: 9, name: '补录任务', status: 1, priority: 1,
          owner_id: 8, owner_name: '孙鑫鑫', owner_ids: [8], plan_date: '2026-08-01',
          actual_date: null, created_at: '2026-08-31 10:00:00+08', is_overdue: 0,
          is_paused: false, is_completed: false, parent_project_paused: false,
          required_delivery: false, delivery_count: 0,
        }] }
      }
      if (/period_analysis:logs/.test(sql)) return { all: async () => [] }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }
  const result = await analyzeBusinessPeriod({
    analysis_period: { preset: 'day', anchor_date: '2026-08-31' },
    business_types: ['task'],
    filters: { only_overdue: true },
  }, { allowedMenuPaths: new Set(['/tasks']) }, database, new Date('2026-09-02T09:00:00Z'))

  assert.equal(result.period_flows.total.became_overdue, 1)
  assert.equal(result.period_flows.total.new_overdue_unresolved, 1)
})

test('暂停项目下的阶段关键事项不进入逾期和临期风险', async () => {
  const database = {
    prepare(sql) {
      if (/period_analysis:records:stage_plan/.test(sql)) {
        return { all: async () => [{
          business_type: 'stage_plan', id: 20, name: '联调', status: 1, priority: 2,
          project_id: 7, project_name: '暂停项目', owner_id: 8, owner_name: '孙鑫鑫', owner_ids: [8],
          plan_date: '2026-09-03', actual_date: null, created_at: '2026-08-01 10:00:00+08',
          is_overdue: 0, is_paused: false, is_completed: false, parent_project_paused: true,
          required_delivery: true, delivery_count: 0,
        }] }
      }
      if (/period_analysis:logs/.test(sql)) return { all: async () => [] }
      if (/period_analysis:financials/.test(sql)) return { get: async () => ({}) }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }
  const result = await analyzeBusinessPeriod({
    analysis_period: { preset: 'day', anchor_date: '2026-09-02' },
    plan_period: { preset: 'day', anchor_date: '2026-09-03' },
    business_types: ['stage_plan'],
  }, { allowedMenuPaths: new Set(['/projects']) }, database, new Date('2026-09-02T09:00:00Z'))

  assert.equal(result.risk_candidates.overdue.total, 0)
  assert.equal(result.risk_candidates.due_soon.total, 0)
  assert.equal(result.risk_candidates.missing_delivery.total, 0)
  assert.equal(result.plan_outlook.total.planned, 0)
})

test('人员筛选和归并覆盖多人负责人、协作人及创建人', async () => {
  const result = await analyzeBusinessPeriod({
    analysis_period: { preset: 'day', anchor_date: '2026-08-31' },
    business_types: ['task'],
    filters: { person_ids: [99] },
    group_by: ['person'],
  }, { allowedMenuPaths: new Set(['/tasks']) }, analysisDatabase(), new Date('2026-09-02T09:00:00Z'))

  assert.equal(result.current_stock.total.total, 1)
  assert.deepEqual(result.groupings.person.map((item) => item.label), ['李东', '创建人'])
})

test('按期完成后重新打开的事项按重新打开日再次进入逾期', async () => {
  const database = {
    prepare(sql) {
      if (/period_analysis:records:task/.test(sql)) return { all: async () => [{
        business_type: 'task', id: 30, name: '重新打开任务', status: 1, priority: 2,
        owner_id: 8, owner_name: '孙鑫鑫', owner_ids: [8], plan_date: '2026-08-31',
        actual_date: null, created_at: '2026-08-01 10:00:00+08', is_overdue: 1,
        is_paused: false, is_completed: false, parent_project_paused: false,
        required_delivery: false, delivery_count: 0,
      }] }
      if (/period_analysis:logs/.test(sql)) return { all: async () => [
        { business_type: 'task', target_id: 30, operation_id: 't1', field_name: 'status', old_value: '1', new_value: '2', created_at: '2026-08-31 10:00:00+08' },
        { business_type: 'task', target_id: 30, operation_id: 't1', field_name: 'actual_end_date', old_value: '', new_value: '2026-08-31', created_at: '2026-08-31 10:00:00+08' },
        { business_type: 'task', target_id: 30, operation_id: 't2', field_name: 'status', old_value: '2', new_value: '1', created_at: '2026-09-01 09:00:00+08' },
      ] }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }
  const result = await analyzeBusinessPeriod({
    analysis_period: { preset: 'day', anchor_date: '2026-09-01' },
    business_types: ['task'],
  }, { allowedMenuPaths: new Set(['/tasks']) }, database, new Date('2026-09-02T09:00:00Z'))

  assert.equal(result.period_flows.total.reopened, 1)
  assert.equal(result.period_flows.total.became_overdue, 1)
  assert.equal(result.period_flows.total.new_overdue_unresolved, 1)
})
