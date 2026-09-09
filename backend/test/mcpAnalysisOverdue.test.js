const assert = require('node:assert/strict')
const test = require('node:test')
const { analyzeBusinessData } = require('../src/services/mcpAnalysisService')

const domains = [
  { domain: 'project', plan: 'expected_end_date', excluded: [2, 3] },
  { domain: 'requirement', plan: 'expected_end_date', excluded: [3, 13, 22, 33, 34, 35] },
  { domain: 'task', plan: 'expected_end_date', excluded: [2, 3] },
  { domain: 'work_order', plan: 'expected_resolve_date', excluded: [2, 4] },
]

for (const { domain, plan, excluded } of domains) {
  test(`${domain} overdue SQL uses live plan dates, business terminal states and Shanghai today`, async () => {
    let query
    const database = { prepare(sql) {
      query = sql
      return { all: async () => [{ value: 0 }] }
    } }
    await analyzeBusinessData({ domain, metric: 'overdue_count' }, database)
    assert.doesNotMatch(query, /is_overdue/)
    assert.match(query, new RegExp(`${plan}[^<]*<`))
    assert.match(query, /AT TIME ZONE 'Asia\/Shanghai'/)
    const exclusions = /status NOT IN \(([^)]+)\)/.exec(query)
    assert.ok(exclusions, 'terminal and paused statuses must be excluded')
    assert.deepEqual(exclusions[1].split(',').map(Number), excluded)
  })
}

test('overdue analysis preserves creation-date, deleted-record and status-zero filters', async () => {
  let query
  let parameters
  const database = { prepare(sql) {
    query = sql
    return { all: async (...args) => { parameters = args; return [{ value: 1 }] } }
  } }
  const result = await analyzeBusinessData({ domain: 'project', metric: 'overdue_count',
    date_from: '2026-09-01', date_to: '2026-09-07', status: 0 }, database)
  assert.match(query, /WHERE is_deleted = 0 AND created_at >= \? AND created_at < \?::date \+ INTERVAL '1 day' AND status = \?/)
  assert.deepEqual(parameters, ['2026-09-01', '2026-09-07', 0])
  assert.deepEqual(result.scope, { dateFrom: '2026-09-01', dateTo: '2026-09-07', status: 0 })
  assert.deepEqual(result.results, [{ value: 1 }])
})

// Optional real PostgreSQL execution: CTE fixtures shadow table names inside SELECT
// only. No tables, business data or persistent settings are changed.
test('PostgreSQL overdue aggregates ignore stale caches and respect date/status boundaries',
  { skip: process.env.MCP_ANALYSIS_DB_TEST !== '1' }, async (t) => {
    const db = require('../src/db')
    const { toPostgresSql } = require('../src/dbSql')
    const client = await db.pool.connect()
    try {
      await client.query('BEGIN READ ONLY')
      await client.query("SET LOCAL TIME ZONE 'UTC'")
      const base = { status: 1, is_deleted: 0, is_overdue: 0,
        expected_end_date: '2026-09-07', expected_resolve_date: '2026-09-07T12:00:00+08:00',
        created_at: '2026-09-03T12:00:00Z' }
      function fixtureDatabase(domain, rows) {
        return { prepare(sql) {
          const query = toPostgresSql(sql).replace(/\$(\d+)/g, (_, index) => `$${Number(index) + 1}`)
            .replace(/CURRENT_TIMESTAMP/g, "TIMESTAMPTZ '2026-09-07T16:30:00Z'")
          return { all: async (...params) => (await client.query(`WITH pms_${domain} AS (
            SELECT * FROM jsonb_to_recordset($1::JSONB) AS fixture(status INTEGER,is_deleted INTEGER,
              is_overdue INTEGER,expected_end_date DATE,expected_resolve_date TIMESTAMPTZ,created_at TIMESTAMPTZ)
            ) ${query}`, [JSON.stringify(rows), ...params])).rows }
        } }
      }
      for (const { domain, excluded } of domains) {
        await t.test(domain, async () => {
          const rows = [
            base,
            { ...base, status: 0 },
            { ...base, is_overdue: 1, expected_end_date: '2026-09-08', expected_resolve_date: '2026-09-08T00:15:00+08:00' },
            { ...base, is_overdue: 1, expected_end_date: '2026-09-09', expected_resolve_date: '2026-09-09T12:00:00+08:00' },
            { ...base, is_overdue: 1, expected_end_date: null, expected_resolve_date: null },
            { ...base, is_deleted: 1, is_overdue: 1 },
            ...excluded.map(status => ({ ...base, status, is_overdue: 1 })),
            ...(domain === 'work_order' ? [{ ...base, status: 5 }] : []),
          ]
          const database = fixtureDatabase(domain, rows)
          const result = await analyzeBusinessData({ domain, metric: 'overdue_count' }, database)
          assert.equal(result.results[0].value, domain === 'work_order' ? 3 : 2)
          for (const status of excluded) {
            const filtered = await analyzeBusinessData({ domain, metric: 'overdue_count', status }, database)
            assert.equal(filtered.results[0].value, 0, `terminal status ${status}`)
          }
        })
      }
      await t.test('creation-date range still scopes the population rather than the due date', async () => {
        const database = fixtureDatabase('project', [
          { ...base, status: 0, created_at: '2026-09-03T12:00:00Z' },
          { ...base, status: 0, created_at: '2026-09-04T23:59:59Z' },
          { ...base, status: 0, created_at: '2026-09-05T00:00:00Z' },
          { ...base, status: 1 },
        ])
        const result = await analyzeBusinessData({ domain: 'project', metric: 'overdue_count',
          date_from: '2026-09-03', date_to: '2026-09-04', status: 0 }, database)
        assert.equal(result.results[0].value, 2)
      })
    } finally {
      await client.query('ROLLBACK')
      client.release()
      await db.pool.end()
    }
  })
