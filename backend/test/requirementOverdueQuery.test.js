const test = require('node:test')
const assert = require('node:assert/strict')
const { createRequirementController } = require('../src/controllers/requirementController')

test('需求读取和筛选不依赖已过期的持久化标记', async () => {
  const queries = []
  const controller = createRequirementController({ prepare(sql) {
    queries.push(sql)
    return { all: async () => [], get: async () => ({ total: 0 }) }
  } })
  const response = { json() {}, status() { return this } }
  await controller.list({ query: { is_overdue: 1 }, user: { id: 1 } }, response)
  await controller.getById({ params: { id: 1 } }, response)
  await controller.neighbors({ query: { id: 1, is_overdue: 1 }, user: { id: 1 } }, response)
  assert.equal(queries.length, 5)
  for (const sql of queries) {
    assert.match(sql, /AT TIME ZONE 'Asia\/Shanghai'/)
    assert.doesNotMatch(sql, /r\.is_overdue\s*=\s*\?/)
  }
  assert.match(queries[0], /END\) AS is_overdue/)
  assert.match(queries[3], /END\) AS is_overdue/)
})

// Read-only CTE fixtures exercise the real controller SQL without changing business data.
test('PostgreSQL 需求列表、详情、统计和相邻记录统一跨日及终态口径', {
  skip: process.env.REQUIREMENT_OVERDUE_DB_TEST !== '1',
}, async () => {
  const db = require('../src/db')
  const { toPostgresSql } = require('../src/dbSql')
  const client = await db.pool.connect()
  const fixtures = `pms_requirement AS (
    SELECT id, status, expected_end_date::date, is_overdue, 0 is_deleted,
      1 product_id,1 owner_id,1 creator_id,1 updater_id,'2026-09-01'::timestamp created_at
    FROM (VALUES (1,31,'2026-09-20',0),(2,31,'2026-09-21',1),(3,31,NULL,1),
      (4,33,'2026-09-20',1),(5,35,'2026-09-20',1),(6,3,'2026-09-20',1),
      (7,13,'2026-09-20',1),(8,22,'2026-09-20',1),(9,34,'2026-09-20',1)
    ) v(id,status,expected_end_date,is_overdue)
  ), pms_product AS (SELECT 1 id,'产品' name), pms_user AS (SELECT 1 id,'负责人' real_name),
  pms_op_log AS (SELECT NULL::text old_value, NULL::text new_value, NULL::text module,
    NULL::int target_id,NULL::text action,NULL::text field_name,NULL::timestamp created_at WHERE FALSE)`
  try {
    await client.query('BEGIN READ ONLY')
    await client.query("SET LOCAL TIME ZONE 'UTC'")
    const controller = createRequirementController({ prepare(sql) {
      const query = toPostgresSql(sql).replace(/CURRENT_TIMESTAMP/g, "TIMESTAMPTZ '2026-09-20T16:01:00Z'")
      const full = query.startsWith('WITH ') ? `WITH ${fixtures}, ${query.slice(5)}` : `WITH ${fixtures} ${query}`
      const rows = async (params) => (await client.query(full, params)).rows
      return { all: (...params) => rows(params), get: async (...params) => (await rows(params))[0] }
    } })
    async function call(method, req) {
      let response
      await controller[method](req, { json(body) { response = body }, status() { return this } })
      assert.equal(response.code, 0)
      return response.data
    }
    const req = (query) => ({ query, user: { id: 1 } })
    const overdue = await call('list', req({ is_overdue: 1 }))
    assert.equal(overdue.total, 1)
    assert.deepEqual(overdue.list.map(row => [row.id,row.is_overdue]), [[1,1]])
    assert.deepEqual(overdue.viewCounts, { all: 1, mine: 1 })
    const normal = await call('list', req({ is_overdue: 0 }))
    assert.deepEqual(normal.list.map(row => row.id), [3,2])
    for (const id of [4,5,6,7,8,9]) {
      assert.equal((await call('getById', { params: { id } })).is_overdue, null)
    }
    assert.equal((await call('getById', { params: { id: 1 } })).is_overdue, 1)
    const neighbors = await call('neighbors', req({ id: 1, is_overdue: 1 }))
    assert.equal(Number(neighbors.total), 1)
    assert.equal(neighbors.prevId, null)
    assert.equal(neighbors.nextId, null)
  } finally {
    await client.query('ROLLBACK')
    client.release()
    await db.pool.end()
  }
})
