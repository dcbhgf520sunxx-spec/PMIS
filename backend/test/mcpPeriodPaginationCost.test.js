const assert = require('node:assert/strict')
const test = require('node:test')
const contentPolicy = require('../src/mcp/contentPolicy')
let conversions = 0
const summarize = contentPolicy.summarizeRichText
contentPolicy.summarizeRichText = (...args) => { conversions++; return summarize(...args) }
const { analyzeBusinessPeriod } = require('../src/services/mcpPeriodAnalysisService')
contentPolicy.summarizeRichText = summarize

const now = new Date('2026-09-08T02:00:00Z')
const args = {
  analysis_period: { preset: 'custom', start_date: '2026-09-01', end_date: '2026-09-08' },
  plan_period: { preset: 'custom', start_date: '2026-09-01', end_date: '2026-09-08' },
  business_types: ['task'],
}
function fixture(count = 120, logs = []) {
  const rows = Array.from({ length: count }, (_, i) => ({ business_type: 'task', id: i + 1,
    name: `<p>事项 ${i + 1}</p>`, status: 1, priority: 1, owner_ids: [], person_ids: [], business_role_ids: [],
    plan_date: '2026-09-04', created_at: '2026-09-01T02:00:00Z', is_completed: false, is_paused: false,
  }))
  return { prepare(sql) {
    if (sql.includes('period_analysis:records:task')) return { all: async () => rows }
    if (sql.includes('period_analysis:logs')) return { all: async () => logs }
    if (/period_analysis:(people|report_people)/.test(sql)) return { all: async () => [] }
    throw new Error(`Unexpected query: ${sql}`)
  } }
}
function analyze(options, data = fixture()) {
  conversions = 0
  return analyzeBusinessPeriod({ ...args, ...options }, { allowedMenuPaths: new Set(['/tasks']) }, data, now)
}

test('只要聚合不要候选时，不清洗全量明细文本', async () => {
  const result = await analyze({ detail_limit: 0 })
  assert.equal(result.period_flows.total.created, 120)
  assert.equal(result.risk_candidates.overdue.total, 120)
  assert.equal(conversions, 0)
})

test('变化、风险、存量、计划分页只加工当前页，并保留全量总数与稳定顺序', async () => {
  for (const [source, metric] of [['flow', 'created'], ['risk', 'overdue'], ['stock', 'total'], ['plan', 'pending']]) {
    const data = fixture()
    const options = { trend_granularity: 'day', group_by: ['person'] }
    const first = await analyze({ ...options, detail_query: { source, metric, page_size: 1 } }, data)
    // analyze resets the conversion counter before each page; only page 2 is measured below.
    const result = await analyze({ ...options,
      detail_query: { source, metric, page: 2, page_size: 1, dataset_token: first.details.datasetToken } }, data)
    assert.equal(result.details.total, 120)
    assert.equal(result.details.items[0].target_id, 2)
    assert.equal(result.details.items[0].name, '事项 2')
    assert.equal(result.details.hasNextPage, true)
    assert.equal(conversions, 1, `${source} 不应加工未请求页或其他候选`)
    const beyond = await analyze({ ...options,
      detail_query: { source, metric, page: 121, page_size: 1, dataset_token: first.details.datasetToken } }, data)
    assert.deepEqual(beyond.details.items, [])
    assert.equal(beyond.details.total, 120)
    assert.equal(conversions, 0)
  }
})

test('单条变化明细的文本加工也受返回字段上限约束，不加工被截断的历史正文', async () => {
  const logs = Array.from({ length: 70 }, (_, i) => ({ business_type: 'task', target_id: 1,
    operation_id: `edit-${i}`, log_id: i + 1, operator_id: 1, field_name: 'expected_end_date',
    old_value: '2026-09-02', new_value: '2026-09-04', created_at: '2026-09-03T02:00:00Z' }))
  const result = await analyze({ detail_query: { source: 'flow', metric: 'important_adjustments', page_size: 1 } }, fixture(120, logs))
  assert.equal(result.details.total, 1)
  const item = result.details.items[0]
  assert.equal(item.changes.length, 50)
  assert.equal(item.changes_total, 70)
  assert.equal(item.changes_truncated, true)
  assert.equal(conversions, 101)
})

test('12000条当前存量明细仍完整计数，只加工当前页且不读取无关历史正文', async t => {
  const logs = [{ business_type: 'task', target_id: 1, operator_id: 9, created_at: '2026-09-03T02:00:00Z' }]
  for (const field of ['old_value', 'new_value', 'field_name']) {
    Object.defineProperty(logs[0], field, { get() { throw new Error('当前存量不需要状态历史或正文') } })
  }
  const data = fixture(12000, logs)
  const started = performance.now()
  const result = await analyze({ detail_query: { source: 'stock', metric: 'total', page_size: 10 } }, data)
  assert.equal(result.details.total, 12000)
  assert.equal(result.details.totalPages, 1200)
  assert.equal(result.coverage.statistics_complete, true)
  assert.equal(conversions, 10)
  assert.deepEqual(result.details.items.map(item => item.target_id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  t.diagnostic(`12000 rows, 10 rich-text conversions, ${(performance.now() - started).toFixed(1)} ms`)
})
