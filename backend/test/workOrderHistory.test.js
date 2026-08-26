const test = require('node:test')
const assert = require('node:assert/strict')
const db = require('../src/db')
const workOrderController = require('../src/controllers/workOrderController')

test('work order history displays batch assignment logs', async () => {
  const originalPrepare = db.prepare

  db.prepare = (sql) => {
    if (sql.includes("WHERE l.module = '运维工单'")) {
      return {
        all: async () => [{
          user_id: 4,
          real_name: '孙鑫鑫',
          action: '批量指派',
          field_name: 'follower_id',
          old_value: '1',
          new_value: '4',
          created_at: '2026-07-11 14:33:40+08'
        }]
      }
    }
    if (sql.startsWith('SELECT id, real_name FROM pms_user')) {
      return {
        all: async () => [
          { id: 1, real_name: '管理员' },
          { id: 4, real_name: '孙鑫鑫' }
        ]
      }
    }
    throw new Error(`Unexpected SQL: ${sql}`)
  }

  const req = { params: { id: '70' } }
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.payload = payload; return this }
  }

  try {
    await workOrderController.getHistory(req, res)
  } finally {
    db.prepare = originalPrepare
  }

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.payload.data, [{
    time: '2026-07-11 14:33:40+08',
    user: '孙鑫鑫',
    title: '批量指派',
    details: [{ field: '跟进人', oldVal: '管理员', newVal: '孙鑫鑫' }]
  }])
})

test('work order history displays i8 sync create and update logs', async () => {
  const originalPrepare = db.prepare

  db.prepare = (sql) => {
    if (sql.includes("WHERE l.module = '运维工单'")) {
      return {
        all: async () => [{
          id: 2,
          operation_id: 'sync-update',
          user_id: 4,
          real_name: '韩健',
          action: 'i8同步更新',
          field_name: 'submitter_name',
          old_value: 'i8',
          new_value: '徐波',
          created_at: '2026-08-26 12:00:00+08'
        }, {
          id: 1,
          operation_id: null,
          user_id: 4,
          real_name: '韩健',
          action: 'i8同步新增',
          field_name: null,
          old_value: null,
          new_value: null,
          created_at: '2026-08-25 08:00:00+08'
        }]
      }
    }
    throw new Error(`Unexpected SQL: ${sql}`)
  }

  const req = { params: { id: '88' } }
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.payload = payload; return this }
  }

  try {
    await workOrderController.getHistory(req, res)
  } finally {
    db.prepare = originalPrepare
  }

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.payload.data, [{
    time: '2026-08-26 12:00:00+08',
    user: '韩健',
    title: 'i8同步更新',
    details: [{ field: '提出人', oldVal: 'i8', newVal: '徐波' }]
  }, {
    time: '2026-08-25 08:00:00+08',
    user: '韩健',
    title: 'i8同步新增',
    details: []
  }])
})
