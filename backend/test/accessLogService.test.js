const assert = require('node:assert/strict')
const test = require('node:test')

const { calculateDurationSeconds, normalizeAccessEvent } = require('../src/services/accessLogService')

test('calculates online duration from login time to logout time', () => {
  assert.equal(
    calculateDurationSeconds('2026-07-04T10:00:00+08:00', '2026-07-04T10:12:35+08:00'),
    755
  )
})

test('normalizes successful login event with session id and active time', () => {
  const event = normalizeAccessEvent({
    eventType: 'login',
    result: 'success',
    sessionId: 'sid-001',
    account: 'admin',
    userId: 1,
    employeeNo: 'admin',
    realName: '管理员',
    now: '2026-07-04T10:00:00+08:00'
  })

  assert.equal(event.sessionId, 'sid-001')
  assert.equal(event.employeeNo, 'admin')
  assert.equal(event.account, 'admin')
  assert.equal(event.loginAt, '2026-07-04T10:00:00+08:00')
  assert.equal(event.lastActiveAt, '2026-07-04T10:00:00+08:00')
  assert.equal(event.durationSeconds, 0)
})

test('normalizes failed login event without user session', () => {
  const event = normalizeAccessEvent({
    eventType: 'login_failed',
    result: 'failed',
    failReason: '密码错误',
    account: 'admin',
    now: '2026-07-04T10:00:00+08:00'
  })

  assert.equal(event.sessionId, null)
  assert.equal(event.userId, null)
  assert.equal(event.employeeNo, null)
  assert.equal(event.account, 'admin')
  assert.equal(event.failReason, '密码错误')
  assert.equal(event.durationSeconds, 0)
})
