const test = require('node:test')
const assert = require('node:assert/strict')
const db = require('../src/db')
const workOrderController = require('../src/controllers/workOrderController')

test('工单详情邻居与列表使用相同的升序口径', async () => {
  const originalPrepare = db.prepare
  let neighborListSql = ''
  let neighborParams

  db.prepare = (sql) => {
    if (sql.includes('WITH ordered AS') && sql.includes('ORDER BY')) {
      neighborListSql = sql
      return { get: async (...params) => { neighborParams = params; return { id: '2', prevId: '1', nextId: '3', total: '3', ordinal: '2' } } }
    }
    throw new Error(`Unexpected SQL: ${sql}`)
  }

  const req = { query: { id: '3', ids: '3,2,2', pageSize: 1, sort_field: 'submit_time', sort_order: 'ascend' } }
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
  assert.deepEqual(neighborParams, [3, 2])
  assert.deepEqual(res.payload.data, { id: 2, prevId: '1', nextId: '3', total: 3, ordinal: 2, page: 2 })
})
