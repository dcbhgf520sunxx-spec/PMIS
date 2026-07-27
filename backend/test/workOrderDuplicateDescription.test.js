const assert = require('node:assert/strict')
const test = require('node:test')
const db = require('../src/db')
const workOrderController = require('../src/controllers/workOrderController')

function createResponse() {
  return {
    locals: {},
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }
}

function validBody(overrides = {}) {
  return {
    product_id: 10,
    problem_type: 20,
    problem_desc: '<p>可重复的问题描述</p>',
    follower_id: 30,
    urgency: 1,
    expected_resolve_date: '2026-07-30',
    submitter_name: '提出人',
    submitter_dept: '提出组织',
    submit_time: '2026-07-27',
    ...overrides
  }
}

test('新增工单允许使用已有有效工单的问题描述', async (t) => {
  const originalPrepare = db.prepare
  const originalWriteLog = db.writeLog
  t.after(() => {
    db.prepare = originalPrepare
    db.writeLog = originalWriteLog
  })

  db.prepare = (sql) => ({
    get: async () => {
      if (sql.includes('WHERE problem_desc = ?')) return { id: 99 }
      return { id: 1 }
    },
    run: async () => ({ lastInsertRowid: 41, changes: 1 })
  })
  db.writeLog = async () => ({ changes: 1 })

  const res = createResponse()
  await workOrderController.create({
    body: validBody(),
    user: { id: 1 },
    ip: '127.0.0.1'
  }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.id, 41)
})

test('编辑工单允许改为其他有效工单已使用的问题描述', async (t) => {
  const originalPrepare = db.prepare
  const originalWriteLogs = db.writeLogs
  t.after(() => {
    db.prepare = originalPrepare
    db.writeLogs = originalWriteLogs
  })

  db.prepare = (sql) => ({
    get: async () => {
      if (sql.includes('WHERE problem_desc = ?')) return { id: 99 }
      if (sql.includes('SELECT product_id')) {
        return {
          product_id: 10,
          problem_type: 20,
          problem_desc: '<p>原问题描述</p>',
          result_desc: null,
          follower_id: 30,
          urgency: 1,
          status: 0,
          is_overdue: 0,
          expected_resolve_date: '2026-07-30',
          resolve_date: null,
          close_date: null,
          submitter_name: '提出人',
          submitter_dept: '提出组织',
          submit_time: '2026-07-27'
        }
      }
      return { id: 1 }
    },
    run: async () => ({ changes: 1 })
  })
  db.writeLogs = async () => 'operation-id'

  const res = createResponse()
  await workOrderController.update({
    params: { id: '41' },
    body: validBody(),
    user: { id: 1 },
    ip: '127.0.0.1'
  }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.code, 0)
})
