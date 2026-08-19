const test = require('node:test')
const assert = require('node:assert/strict')

const servicePath = '../src/services/businessAttachmentService'

function fakeDb({ businessExists = true, attachmentCount = 0 } = {}) {
  const calls = []
  return {
    calls,
    prepare(sql) {
      return {
        async get(...params) {
          calls.push({ kind: 'get', sql, params })
          if (sql.includes('COUNT(*)')) return { total: attachmentCount }
          if (sql.includes('FROM pms_task')) return businessExists ? { id: 7 } : undefined
          return undefined
        },
        async all(...params) {
          calls.push({ kind: 'all', sql, params })
          return []
        },
        async run(...params) {
          calls.push({ kind: 'run', sql, params })
          return { id: 12 }
        },
      }
    },
  }
}

test('任务附件上传前校验业务记录存在，并在达到10个时拒绝继续上传', async () => {
  const { assertBusinessCanAcceptAttachment } = require(servicePath)

  await assert.rejects(
    assertBusinessCanAcceptAttachment(fakeDb({ businessExists: false }), 'task', 7),
    /任务不存在或已删除/
  )
  await assert.rejects(
    assertBusinessCanAcceptAttachment(fakeDb({ businessExists: true, attachmentCount: 10 }), 'task', 7),
    /最多上传10个附件/
  )
  await assert.doesNotReject(
    assertBusinessCanAcceptAttachment(fakeDb({ businessExists: true, attachmentCount: 9 }), 'task', 7)
  )
})

test('业务记录删除时附件只做软删除并记录操作人', async () => {
  const { softDeleteBusinessAttachments } = require(servicePath)
  const db = fakeDb()

  await softDeleteBusinessAttachments(db, 'task', 7, 23)

  const update = db.calls.find((call) => call.kind === 'run')
  assert.match(update.sql, /UPDATE pms_business_attachment SET is_deleted=1/)
  assert.deepEqual(update.params, [23, 'task', 7])
})
