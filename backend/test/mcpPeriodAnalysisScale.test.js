const assert = require('node:assert/strict')
const test = require('node:test')
const { performance } = require('node:perf_hooks')
const { analyzeBusinessPeriod } = require('../src/services/mcpPeriodAnalysisService')

for (const size of [1000, 10000]) {
  test(`${size} 条真实行形事项及历史完整计数，续页令牌不依赖页码或候选限量`, async t => {
    const rows = Array.from({ length: size }, (_, index) => ({
      business_type: 'task', id: index + 1, name: `规模核验任务${index + 1}`, status: 1, priority: 1,
      product_id: 11, product_name: '产品', project_id: 12, project_name: '项目', requirement_id: null,
      requirement_name: null, owner_id: 8, owner_name: '负责人', owner_ids: [8], business_role_ids: [8],
      person_ids: [8], creator_id: 8, updater_id: 8, parent_task_id: index % 2 ? index : null,
      created_at: '2026-09-01 09:00:00+08', plan_date: '2026-09-05', actual_date: null, pause_date: null,
      is_completed: false, is_paused: false, is_overdue: 1,
      parent_project_paused: false, required_delivery: false, delivery_count: 0,
    }))
    const logs = rows.map(record => ({
      business_type: 'task', target_id: record.id, log_id: record.id, operation_id: `status-${record.id}`,
      operator_id: 8, action: '状态变更', field_name: 'status', old_value: '0', new_value: '1',
      created_at: '2026-09-02 09:30:00.123456+08',
    }))
    const database = { prepare(sql) {
      if (/period_analysis:records:task/.test(sql)) return { all: async () => rows }
      if (/period_analysis:logs/.test(sql)) return { all: async () => logs }
      if (/period_analysis:(people|report_people)/.test(sql)) return { all: async () => [{ id: 8, name: '负责人', status: 1, is_deleted: 0 }] }
      throw new Error(`Unexpected query: ${sql}`)
    } }
    const args = { analysis_period: { preset: 'custom', start_date: '2026-09-01', end_date: '2026-09-06' },
      business_types: ['task'], detail_query: { source: 'flow', metric: 'created', page_size: 100 } }
    const context = { user: { id: 8 }, allowedMenuPaths: new Set(['/tasks']) }
    const now = new Date('2026-09-08T04:00:00Z')
    const start = performance.now()
    const first = await analyzeBusinessPeriod(args, context, database, now)
    const firstMs = performance.now() - start
    const nextStart = performance.now()
    const second = await analyzeBusinessPeriod({ ...args, detail_limit: 0,
      detail_query: { ...args.detail_query, page: 2, dataset_token: first.details.datasetToken } }, context, database,
    new Date('2026-09-08T04:01:00Z'))
    const secondMs = performance.now() - nextStart
    assert.equal(first.details.total, size)
    assert.equal(first.details.items.length, 100)
    assert.equal(first.details.items[0].target_id, 1)
    assert.equal(second.details.items[0].target_id, 101)
    assert.equal(second.details.datasetToken, first.details.datasetToken)
    assert.equal(second.coverage.statistics_complete, true)
    t.diagnostic(JSON.stringify({ rows: size, logs: logs.length, first_page_ms: Math.round(firstMs), second_page_ms: Math.round(secondMs) }))
  })
}
