const crypto = require('crypto')
const db = require('../db')

function calculateDurationSeconds(startTime, endTime) {
  if (!startTime || !endTime) return 0
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return Math.floor((end - start) / 1000)
}

function normalizeAccessEvent(input) {
  const now = input.now || new Date().toISOString()
  const isSuccessLogin = input.eventType === 'login' && input.result === 'success'

  return {
    userId: input.userId || null,
    employeeNo: input.employeeNo || null,
    account: input.account || '',
    realName: input.realName || null,
    eventType: input.eventType,
    result: input.result,
    failReason: input.failReason || null,
    sessionId: input.sessionId || null,
    loginAt: isSuccessLogin ? now : null,
    logoutAt: null,
    lastActiveAt: isSuccessLogin ? now : null,
    durationSeconds: 0,
    ip: input.ip || null,
    userAgent: input.userAgent || null,
    now
  }
}

function getRequestMeta(req) {
  return {
    ip: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null
  }
}

async function recordAccessEvent(input) {
  const event = normalizeAccessEvent(input)
  const result = await db.prepare(
    `INSERT INTO pms_access_log (
      user_id, employee_no, account, real_name, event_type, result, fail_reason, session_id,
      login_at, logout_at, last_active_at, duration_seconds, ip, user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    event.userId,
    event.employeeNo,
    event.account,
    event.realName,
    event.eventType,
    event.result,
    event.failReason,
    event.sessionId,
    event.loginAt,
    event.logoutAt,
    event.lastActiveAt,
    event.durationSeconds,
    event.ip,
    event.userAgent
  )

  return { ...event, id: result.lastInsertRowid }
}

async function recordLoginSuccess({ user, account, req }) {
  const meta = getRequestMeta(req)
  const sessionId = crypto.randomUUID()
  const event = await recordAccessEvent({
    eventType: 'login',
    result: 'success',
    sessionId,
    account,
    userId: user.id,
    employeeNo: user.employee_no,
    realName: user.real_name,
    ip: meta.ip,
    userAgent: meta.userAgent
  })

  return event.sessionId
}

async function recordLoginFailure({ account, failReason, result = 'failed', req, user }) {
  const meta = getRequestMeta(req)
  return recordAccessEvent({
    eventType: 'login_failed',
    result,
    failReason,
    account,
    userId: user?.id,
    employeeNo: user?.employee_no,
    realName: user?.real_name,
    ip: meta.ip,
    userAgent: meta.userAgent
  })
}

async function touchSession({ userId, sessionId }) {
  if (!sessionId) return null
  const row = await db.prepare(
    'SELECT id, login_at FROM pms_access_log WHERE session_id = ? AND user_id = ? AND result = ?'
  ).get(sessionId, userId, 'success')
  if (!row) return null

  const now = new Date().toISOString()
  const durationSeconds = calculateDurationSeconds(row.login_at, now)
  await db.prepare(
    'UPDATE pms_access_log SET last_active_at = ?, duration_seconds = ? WHERE id = ?'
  ).run(now, durationSeconds, row.id)

  return { id: row.id, lastActiveAt: now, durationSeconds }
}

async function endSession({ userId, sessionId, preserveLastActive = false }) {
  if (!sessionId) return null
  const row = await db.prepare(
    'SELECT id, login_at, last_active_at FROM pms_access_log WHERE session_id = ? AND user_id = ? AND result = ?'
  ).get(sessionId, userId, 'success')
  if (!row) return null

  const now = new Date().toISOString()
  const activeEndTime = preserveLastActive ? (row.last_active_at || now) : now
  const durationSeconds = calculateDurationSeconds(row.login_at, activeEndTime)
  if (preserveLastActive) {
    await db.prepare(
      'UPDATE pms_access_log SET logout_at = ?, duration_seconds = ? WHERE id = ?'
    ).run(now, durationSeconds, row.id)
  } else {
    await db.prepare(
      'UPDATE pms_access_log SET logout_at = ?, last_active_at = ?, duration_seconds = ? WHERE id = ?'
    ).run(now, now, durationSeconds, row.id)
  }

  return { id: row.id, logoutAt: now, lastActiveAt: activeEndTime, durationSeconds }
}

async function listAccessLogs(query = {}) {
  const params = []
  let sql = `SELECT
      l.id, l.user_id, l.employee_no, l.account, l.real_name, l.event_type, l.result, l.fail_reason,
      l.session_id, l.login_at, l.logout_at, l.last_active_at, l.duration_seconds,
      l.ip, l.user_agent, l.created_at
    FROM pms_access_log l
    WHERE 1 = 1`

  if (query.employee_no) {
    sql += ' AND l.employee_no LIKE ?'
    params.push(`%${query.employee_no}%`)
  }
  if (query.account) {
    sql += ' AND l.account LIKE ?'
    params.push(`%${query.account}%`)
  }
  if (query.real_name) {
    sql += ' AND l.real_name LIKE ?'
    params.push(`%${query.real_name}%`)
  }
  if (query.result) {
    sql += ' AND l.result = ?'
    params.push(query.result)
  }
  if (query.fail_reason) {
    sql += ' AND l.fail_reason = ?'
    params.push(query.fail_reason)
  }
  if (query.ip) {
    sql += ' AND l.ip LIKE ?'
    params.push(`%${query.ip}%`)
  }
  if (query.start_time) {
    sql += ' AND l.created_at >= ?'
    params.push(query.start_time)
  }
  if (query.end_time) {
    sql += ' AND l.created_at <= ?'
    params.push(query.end_time)
  }

  sql += ' ORDER BY l.created_at DESC, l.id DESC LIMIT 1000'
  return db.prepare(sql).all(...params)
}

module.exports = {
  calculateDurationSeconds,
  normalizeAccessEvent,
  recordLoginSuccess,
  recordLoginFailure,
  touchSession,
  endSession,
  listAccessLogs
}
