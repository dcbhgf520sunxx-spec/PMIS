const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const db = require('../src/db')
const workOrderController = require('../src/controllers/workOrderController')

const controllerFiles = [
  'workOrderController.js',
  'userController.js',
  'roleController.js',
  'archiveController.js',
  'archiveTypeController.js',
  'menuController.js'
]

test('write controllers derive operator identity from req.user instead of req.body', () => {
  const controllerDirectory = path.join(__dirname, '../src/controllers')
  const allControllerFiles = fs.readdirSync(controllerDirectory).filter((file) => file.endsWith('Controller.js'))
  for (const file of allControllerFiles) {
    const source = fs.readFileSync(path.join(__dirname, '../src/controllers', file), 'utf8')
    assert.doesNotMatch(
      source,
      /const\s*\{[^}]*\b(?:creator_id|updater_id)\b[^}]*\}\s*=\s*req\.body/,
      `${file} still trusts an operator id from req.body`
    )
  }
  for (const file of controllerFiles) {
    const source = fs.readFileSync(path.join(controllerDirectory, file), 'utf8')
    assert.match(source, /req\.user\.id/, `${file} does not use the authenticated user id`)
  }
})

test('work order creation ignores a forged creator_id and records the authenticated user', async () => {
  const originalPrepare = db.prepare
  const originalWriteLog = db.writeLog
  let insertArgs
  let logUserId

  db.prepare = (sql) => {
    if (sql.startsWith('SELECT id FROM pms_work_order')) return { get: async () => undefined }
    if (sql.includes('FROM pms_archive a')) return { get: async () => ({ id: 1 }) }
    if (sql.startsWith('SELECT id FROM pms_product')) return { get: async () => ({ id: 1 }) }
    if (sql.startsWith('SELECT id FROM pms_user')) return { get: async () => ({ id: 2 }) }
    if (sql.startsWith('INSERT INTO pms_work_order')) {
      return {
        run: async (...args) => {
          insertArgs = args
          return { lastInsertRowid: 77 }
        }
      }
    }
    throw new Error(`Unexpected SQL: ${sql}`)
  }
  db.writeLog = async (userId) => { logUserId = userId }

  const req = {
    body: {
      product_id: 1,
      problem_type: 2,
      problem_desc: 'identity regression test',
      follower_id: 2,
      urgency: 1,
      expected_resolve_date: '2026-07-20',
      submitter_name: '测试人',
      submitter_dept: '测试部门',
      submit_time: '2026-07-11',
      creator_id: 999,
      updater_id: 999
    },
    user: { id: 2 },
    ip: '127.0.0.1'
  }
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.payload = payload; return this }
  }

  try {
    await workOrderController.create(req, res)
  } finally {
    db.prepare = originalPrepare
    db.writeLog = originalWriteLog
  }

  assert.equal(res.statusCode, 200)
  assert.deepEqual(insertArgs.slice(-2), [2, 2])
  assert.equal(logUserId, 2)
})
