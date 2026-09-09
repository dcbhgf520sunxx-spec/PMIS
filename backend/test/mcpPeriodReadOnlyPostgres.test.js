const assert = require('node:assert/strict')
const test = require('node:test')
const db = require('../src/db')
const { analyzeBusinessPeriod } = require('../src/services/mcpPeriodAnalysisService')

test('PostgreSQL只读CTE验证明细操作人查询按上海日边界读取且不选择历史正文', {
  skip: process.env.MCP_PERIOD_PG_READONLY_TEST !== '1',
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(db.pool.options.host))
  assert.equal(Number(db.pool.options.port), 5433)
  let logSql
  const database = { prepare(sql) {
    if (sql.includes('period_analysis:records:task')) return { all: async () => [{
      business_type: 'task', id: 1, name: 'CTE测试事项', status: 1, priority: 1,
      owner_id: 8, owner_ids: [8], owner_name: '负责人', business_role_ids: [8], person_ids: [8],
      plan_date: '2026-09-08', created_at: '2026-09-01T00:00:00+08',
      is_completed: false, is_paused: false,
    }] }
    if (sql.includes('period_analysis:people')) return { all: async (...ids) => ids.map(id => ({ id, name: `人员${id}` })) }
    assert.ok(sql.includes('period_analysis:logs'))
    logSql = sql
    // Lexically shadow the production table with a read-only CTE. No real
    // business rows are read or written, and there is no persistent test state.
    return db.prepare(`WITH pms_op_log AS (
      SELECT id, user_id, '编辑'::text action, '任务'::text module, 1::bigint target_id,
        NULL::uuid operation_id, created_at
      FROM (VALUES
        (1::bigint, 9::bigint, '2026-09-07T15:59:59Z'::timestamptz),
        (2::bigint, 10::bigint, '2026-09-07T16:00:00Z'::timestamptz),
        (3::bigint, 11::bigint, '2026-09-08T15:59:59Z'::timestamptz),
        (4::bigint, 12::bigint, '2026-09-08T16:00:00Z'::timestamptz)
      ) AS fixture(id, user_id, created_at)
    ) ${sql}`)
  } }
  try {
    const result = await analyzeBusinessPeriod({ business_types: ['task'],
      analysis_period: { preset: 'day', anchor_date: '2026-09-08' },
      detail_query: { source: 'stock', metric: 'total' },
    }, { allowedMenuPaths: new Set(['/tasks']) }, database, new Date('2026-09-09T01:00:00Z'))
    assert.equal(result.coverage.statistics_complete, true)
    assert.equal(result.details.total, 1)
    assert.deepEqual(result.details.items[0].people.filter(person => person.relations.includes('operator'))
      .map(person => person.user_id), [10, 11])
    assert.doesNotMatch(logSql, /old_value|new_value|field_name/)
  } finally {
    await db.pool.end()
  }
})
