const test = require('node:test')
const assert = require('node:assert/strict')
const db = require('../src/db')
const workOrderController = require('../src/controllers/workOrderController')

test('工单详情邻居与列表使用相同的升序口径', async () => {
  const originalPrepare = db.prepare
  let neighborListSql = ''

  db.prepare = (sql) => {
    if (sql.startsWith('SELECT created_at, id FROM pms_work_order')) {
      return { get: async () => ({ id: 2, created_at: '2026-07-11 10:00:00' }) }
    }
    if (sql.startsWith('SELECT id FROM pms_work_order w WHERE w.id = ?')) {
      return { get: async () => ({ id: 2 }) }
    }
    if (sql.includes('FROM pms_work_order w') && sql.includes('ORDER BY')) {
      neighborListSql = sql
      return { all: async () => [{ id: 1 }, { id: 2 }, { id: 3 }] }
    }
    throw new Error(`Unexpected SQL: ${sql}`)
  }

  const req = { query: { id: '2', sort_field: 'submit_time', sort_order: 'ascend' } }
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.payload = payload; return this }
  }

  try {
    await workOrderController.getNeighbors(req, res)
  } finally {
    db.prepare = originalPrepare
  }

  assert.match(neighborListSql, /ORDER BY w\.submit_time ASC, w\.id ASC/)
  assert.deepEqual(res.payload.data, { prevId: 1, nextId: 3, total: 3, ordinal: 2 })
})
