const assert = require('node:assert/strict')
const test = require('node:test')
const { analyzeBusinessPeriod } = require('../src/services/mcpPeriodAnalysisService')

const now = new Date('2026-09-08T04:00:00Z')
const context = { user: { id: 8 }, allowedMenuPaths: new Set(['/tasks', '/projects']) }
const base = { analysis_period: { preset: 'day', anchor_date: '2026-09-08' }, business_types: ['task'] }
const task = {
  business_type: 'task', id: 1, name: '核验接口', status: 1, priority: 2,
  project_id: 3, project_name: '项目', owner_id: 8, owner_ids: [8], business_role_ids: [8],
  person_ids: [8], person_names: [], creator_id: 9, updater_id: 9,
  created_at: '2026-09-08T01:00:00Z', plan_date: '2026-09-07',
  is_completed: false, is_paused: false, required_delivery: false, delivery_count: 0,
}
function fixture({ fail = [], logs = [], rows = [task] } = {}) {
  const calls = []
  return { calls, prepare(sql) {
    const marker = /period_analysis:([a-z_:]+)/.exec(sql)?.[1]
    assert.ok(marker, '查询须限定在周期分析数据来源')
    calls.push(marker)
    const read = async (...ids) => {
      if (fail.includes(marker)) throw new Error('受控数据来源故障')
      if (marker === 'records:task') return rows.map(row => ({ ...row }))
      if (marker === 'logs') return logs
      if (['people', 'report_people'].includes(marker)) return [...new Set(ids)].map(id => ({ id, name: `真实姓名${id}`, status: 1, is_deleted: 0 }))
      if (marker === 'financials') return { contract_count: 1, contract_amount: 100 }
      return []
    }
    return { all: read, get: read }
  } }
}
const run = (args, database) => analyzeBusinessPeriod({ ...base, ...args }, context, database, now)

for (const sections of [[], ['current_stock', 'current_stock'], ['unknown'], 'current_stock', [null], [1], null]) {
  test(`服务拒绝非法 sections ${JSON.stringify(sections)}`, async () => {
    await assert.rejects(run({ sections }, fixture()), error => error.code === 'MCP_ARGUMENT_INVALID' && Boolean(error.fieldErrors.sections))
  })
}

test('仅新增聚合不读取历史、业务关联人员、姓名补查及财务', async () => {
  const database = fixture()
  const result = await run({ sections: ['period_flows'], metrics: ['created'] }, database)
  assert.deepEqual(Object.keys(result).sort(), ['coverage', 'data_cutoff', 'period_flows', 'resolved_periods'])
  assert.deepEqual(result.period_flows.total, { created: 1 })
  assert.deepEqual(database.calls, ['records:task'])
  assert.equal(result.coverage.statistics_complete, true)
  assert.equal(result.coverage.component_completeness.event_history, null)
  assert.equal(result.coverage.component_completeness.report_people, null)
  assert.equal(result.coverage.component_completeness.current_stock, null)
  assert.deepEqual(result.coverage.requested_sections, ['period_flows'])
  assert.deepEqual(result.coverage.section_completeness, { period_flows: true })
})

test('仅当前存量不因未请求历史或人员来源故障误报不完整', async () => {
  const database = fixture({ fail: ['logs', 'people', 'report_people'] })
  const result = await run({ sections: ['current_stock'] }, database)
  assert.equal(result.current_stock.total.total, 1)
  assert.equal(result.coverage.statistics_complete, true)
  assert.deepEqual(database.calls, ['records:task'])
})

for (const relation of ['operator', 'related']) {
  test(`当前存量 ${relation} 筛选保留历史依赖并披露失败`, async () => {
    const result = await run({ sections: ['current_stock'], filters: { person_ids: [8], person_relation: relation } }, fixture({ fail: ['logs'] }))
    assert.equal(result.coverage.component_completeness.event_history, false)
    assert.equal(result.coverage.section_completeness.current_stock, false)
    assert.equal(result.coverage.statistics_complete, false)
  })
}

test('选择非新增事件、计划和质量仍读取历史并按所选块披露失败', async () => {
  for (const args of [
    { sections: ['period_flows'], metrics: ['completed'] },
    { sections: ['plan_outlook'], plan_period: base.analysis_period },
    { sections: ['quality_and_delivery'], metrics: ['created'] },
    { sections: ['groupings'], group_by: ['project'], plan_period: base.analysis_period, metrics: ['created'] },
  ]) {
    const result = await run(args, fixture({ fail: ['logs'] }))
    assert.equal(result.coverage.statistics_complete, false, args.sections[0])
    assert.equal(result.coverage.section_completeness[args.sections[0]], false)
  }
})

test('人员分组与候选输出实际姓名和操作人关系，姓名来源失败不得假完整', async () => {
  const logs = [{ business_type: 'task', target_id: 1, operator_id: 10, log_id: 1, field_name: 'priority', old_value: '1', new_value: '2', created_at: '2026-09-08T02:00:00Z' }]
  const grouped = await run({ sections: ['groupings'], group_by: ['person'], metrics: ['created'] }, fixture({ logs }))
  assert.equal(grouped.groupings.person.find(group => group.key === 10).label, '真实姓名10')
  const candidates = await run({ sections: ['flow_candidates'], metrics: ['created'] }, fixture({ logs }))
  assert.equal(candidates.flow_candidates.created.items[0].people.find(person => person.user_id === 10).name, '真实姓名10')
  const failed = await run({ sections: ['risk_candidates'] }, fixture({ fail: ['report_people'] }))
  assert.equal(failed.coverage.statistics_complete, false)
  assert.equal(failed.coverage.component_completeness.risk_candidates, false)
})

test('created-only 的对比、趋势、非人员归并仅使用业务记录', async () => {
  const database = fixture()
  const result = await run({ sections: ['comparison', 'trend', 'groupings'], metrics: ['created'],
    comparison_period: { preset: 'day', anchor_date: '2026-09-07' }, trend_granularity: 'day', group_by: ['project'],
  }, database)
  assert.deepEqual(result.comparison.metrics.created, { current: 1, comparison: 0, absolute_change: 1 })
  assert.deepEqual(result.trend.buckets[0].period_flows, { created: 1 })
  assert.deepEqual(result.groupings.project[0].period_flows, { created: 1 })
  assert.equal(result.groupings.project[0].current_stock.total, 1)
  assert.deepEqual(database.calls, ['records:task'])
  assert.equal(result.coverage.statistics_complete, true)
})

test('零候选上限仍返回完整数量，但不加载历史人员及加工候选', async () => {
  const database = fixture()
  const result = await run({ sections: ['flow_candidates', 'risk_candidates'], metrics: ['created'], detail_limit: 0 }, database)
  assert.deepEqual(result.flow_candidates.created, { items: [], total: 1, has_more: true })
  assert.deepEqual(result.risk_candidates.overdue, { items: [], total: 1, has_more: true })
  assert.deepEqual(database.calls, ['records:task'])
  assert.equal(result.coverage.statistics_complete, true)
})

test('仅业务角色的存量筛选不需要操作历史', async () => {
  const database = fixture()
  const result = await run({ sections: ['current_stock'], filters: { person_ids: [8], person_relation: 'business_role' } }, database)
  assert.equal(result.current_stock.total.total, 1)
  assert.equal(result.coverage.statistics_complete, true)
  assert.deepEqual(database.calls, ['records:task'])
})

test('单独请求业务关联人员仍使用操作历史并补齐真实姓名', async () => {
  const database = fixture({ logs: [{ business_type: 'task', target_id: 1, operator_id: 10, log_id: 1,
    field_name: 'priority', old_value: '1', new_value: '2', created_at: '2026-09-08T02:00:00Z' }] })
  const result = await run({ sections: ['report_people'] }, database)
  assert.deepEqual(result.report_people.find(person => person.user_id === 10), {
    user_id: 10, name: '真实姓名10', sources: ['operator'], related_record_count: 1, period_operation_count: 1,
  })
  assert.deepEqual(database.calls, ['records:task', 'people', 'logs', 'report_people'])
  assert.equal(result.coverage.component_completeness.period_flows, null)
})

test('显式财务失败影响所请求统计，默认辅助财务失败仍隔离', async () => {
  const selected = await run({ sections: ['financials'] }, fixture({ fail: ['financials'] }))
  assert.equal(selected.financials.available, false)
  assert.equal(selected.coverage.statistics_complete, false)
  assert.deepEqual(selected.coverage.section_completeness, { financials: false })
  const normal = await run({}, fixture({ fail: ['financials'] }))
  assert.equal(normal.coverage.statistics_complete, true)
  assert.equal(normal.coverage.requested_sections, undefined)
  assert.equal(normal.coverage.section_completeness, undefined)
})

test('显式请求无权限财务不得宣称完整，也不得加载未授权财务', async () => {
  const database = fixture()
  const result = await analyzeBusinessPeriod({ ...base, sections: ['financials'] },
    { ...context, allowedMenuPaths: new Set(['/tasks']) }, database, now)
  assert.equal(result.financials.available, false)
  assert.equal(result.coverage.statistics_complete, false)
  assert.equal(result.coverage.section_completeness.financials, false)
  assert.equal(result.coverage.component_completeness.financials, null)
  assert.match(result.financials.error, /权限/)
  assert.deepEqual(database.calls, ['records:task'])
})

test('可空块保留既有 null/空对象行为，不额外读取依赖', async () => {
  const database = fixture()
  const result = await run({ sections: ['comparison', 'trend', 'plan_outlook', 'groupings'] }, database)
  assert.equal(result.comparison, null)
  assert.equal(result.trend, null)
  assert.equal(result.plan_outlook, null)
  assert.deepEqual(result.groupings, {})
  assert.deepEqual(database.calls, ['records:task'])
})

test('明细优先，sections 改变不改变数据集 token 或阻断续页', async () => {
  const database = fixture({ rows: [task, { ...task, id: 2 }] })
  const first = await run({ sections: ['current_stock'], detail_query: { source: 'stock', metric: 'total', page_size: 1 } }, database)
  const second = await run({ sections: ['financials'], detail_query: { source: 'stock', metric: 'total', page: 2, page_size: 1, dataset_token: first.details.datasetToken } }, database)
  assert.equal(second.details.items[0].target_id, 2)
  assert.equal(first.details.datasetToken, second.details.datasetToken)
  assert.equal(second.coverage.requested_sections, undefined)
  assert.equal(second.coverage.section_completeness, undefined)
  assert.deepEqual(Object.keys(second).sort(), ['coverage', 'data_cutoff', 'details', 'resolved_periods'])
})

test('存量明细不计算计划、流量、人员统计及无关历史，仅保留当期操作人关系依赖', async () => {
  const database = fixture({ logs: [{ business_type: 'task', target_id: 1, operator_id: 10,
    created_at: '2026-09-08T02:00:00Z' }] })
  const sqlCalls = []
  const prepare = database.prepare
  database.prepare = sql => { sqlCalls.push(sql); return prepare(sql) }
  const result = await run({ sections: ['financials', 'groupings', 'plan_outlook'],
    plan_period: { preset: 'day', anchor_date: '2026-09-07' }, group_by: ['person'],
    detail_query: { source: 'stock', metric: 'total' },
  }, database)
  assert.equal(result.details.total, 1)
  assert.equal(result.coverage.statistics_complete, true)
  assert.equal(result.coverage.component_completeness.period_flows, null)
  assert.equal(result.coverage.component_completeness.plan_outlook, null)
  assert.equal(result.coverage.component_completeness.report_people, null)
  assert.equal(result.details.items[0].people.find(person => person.user_id === 10).name, '真实姓名10')
  assert.ok(!database.calls.includes('report_people'))
  const historySql = sqlCalls.find(sql => sql.includes('period_analysis:logs'))
  assert.ok(!historySql.includes('old_value'))
  assert.match(historySql, /created_at\s*>=/)
  assert.match(historySql, /created_at\s*</)
})

test('负责人逾期集中明细不展示操作人，因此无操作人筛选时不读日志', async () => {
  const database = fixture({ rows: [task, { ...task, id: 2 }], fail: ['logs', 'report_people'] })
  const result = await run({ detail_query: { source: 'risk', metric: 'workload_concentration' } }, database)
  assert.deepEqual(result.details.items, [{ owner_id: 8, owner_name: '真实姓名8', overdue_count: 2 }])
  assert.equal(result.coverage.statistics_complete, true)
  assert.equal(result.coverage.component_completeness.event_history, null)
  assert.ok(!database.calls.includes('logs'))
})

test('人员明细不补查事项展示姓名，也不读取或计算计划与事件历史', async () => {
  const database = fixture({ fail: ['people'], logs: [{ business_type: 'task', target_id: 1, operator_id: 10,
    created_at: '2026-09-08T02:00:00Z' }] })
  const result = await run({ plan_period: { preset: 'day', anchor_date: '2026-09-07' },
    detail_query: { source: 'people' } }, database)
  assert.equal(result.details.total, 3)
  assert.equal(result.coverage.statistics_complete, true)
  assert.deepEqual(database.calls, ['records:task', 'logs', 'report_people'])
  assert.equal(result.coverage.component_completeness.plan_outlook, null)
  assert.equal(result.coverage.component_completeness.period_flows, null)
})
