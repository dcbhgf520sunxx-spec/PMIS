const express = require('express')
const router = express.Router()
const db = require('../db')
const bcrypt = require('bcryptjs')
const { requestTicket } = require('../services/ssoService')
const { verifyToken } = require('../middleware/auth')
const accessLogService = require('../services/accessLogService')
const accountService = require('../services/accountService')
const { createAuthSessionService } = require('../services/authSessionService')
const { createLoginCaptchaService } = require('../services/loginCaptchaService')
const { createLoginRateLimitService } = require('../services/loginRateLimitService')
const { ok, fail, failField } = require('../utils/response')

const authSessionService = createAuthSessionService()
const loginCaptchaService = createLoginCaptchaService()
const loginRateLimitService = createLoginRateLimitService()

async function safeRecordLoginFailure(payload) {
  try {
    await accessLogService.recordLoginFailure(payload)
  } catch (err) {
    console.error('access log write failed:', err.message)
  }
}

router.get('/captcha', (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    return ok(res, loginCaptchaService.issue(req.ip || 'unknown'))
  } catch (error) {
    if (error.statusCode === 429) {
      res.set('Retry-After', '60')
      return fail(res, 429, 429, error.message)
    }
    console.error('login captcha generation failed:', error.message)
    return fail(res, 500, 500, '验证码加载失败，请重试')
  }
})

// Login
router.post('/login', async (req, res) => {
  let attempt
  try {
    const clientIp = req.ip || 'unknown'
    const { account, password, captcha_id, captcha_code } = req.body || {}
    const retryAfter = loginRateLimitService.takeRequest(clientIp)
    if (retryAfter) {
      res.set('Retry-After', String(retryAfter))
      return fail(res, 429, 429, `登录请求过于频繁，请${retryAfter}秒后重试`)
    }
    if (typeof account !== 'string' || !account.trim() || account.length > 100 || typeof password !== 'string' || !password) {
      return fail(res, 400, 400, '请输入有效的账号和密码')
    }
    if (!loginCaptchaService.consume(clientIp, captcha_id, captcha_code)) {
      await safeRecordLoginFailure({ account, failReason: '验证码校验失败', req })
      return failField(res, 'captcha_code', '验证码错误或已过期，请重新输入')
    }

    const row = await db.prepare(
      'SELECT id, employee_no, real_name, phone, avatar_url, password, status, first_login FROM pms_user WHERE (employee_no = ? OR phone = ?) AND is_deleted = 0'
    ).get(account, account)
    // 工号和手机共享账号预算；不存在的输入也隔离，不能牵连同出口其他人。
    attempt = loginRateLimitService.begin(row ? `user:${row.id}` : `unknown:${account.trim()}`, { knownAccount: Boolean(row) })
    if (attempt.retryAfter) {
      res.set('Retry-After', String(attempt.retryAfter))
      const reason = attempt.reason === 'locked' ? '账号登录频率限制' : attempt.reason === 'pending' ? '账号并发登录限制' : '登录保护容量限制'
      await safeRecordLoginFailure({ account, failReason: reason, result: 'locked', req, user: row })
      const message = attempt.reason === 'locked' ? '该账号登录尝试过多' : '登录验证繁忙'
      return fail(res, 429, 429, `${message}，请${attempt.retryAfter}秒后重试`)
    }
    if (!row) {
      attempt.complete('failure')
      await safeRecordLoginFailure({ account, failReason: '用户不存在', req })
      return fail(res, 401, 401, '账号或密码错误')
    }

    const valid = await bcrypt.compare(password, row.password)
    if (!valid) {
      attempt.complete('failure')
      await safeRecordLoginFailure({ account, failReason: '密码错误', req, user: row })
      return fail(res, 401, 401, '账号或密码错误')
    }

    if (row.status !== 1) {
      attempt.complete('failure')
      await safeRecordLoginFailure({ account, failReason: '账号已停用', req, user: row })
      return res.status(403).json({ code: 403, message: '账号已停用', data: null })
    }

    const result = await authSessionService.createSession({
      user: row,
      account,
      req,
      authMethod: 'password'
    })
    attempt.complete('success')
    ok(res, result, '登录成功')
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '登录失败', data: null })
  } finally {
    attempt?.complete?.()
  }
})

router.post('/heartbeat', verifyToken, async (req, res) => {
  try {
    const result = await accessLogService.touchSession({
      userId: req.user.id,
      sessionId: req.body.session_id
    })
    res.json({ code: 0, message: 'success', data: result })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '更新访问状态失败', data: null })
  }
})

router.post('/logout', verifyToken, async (req, res) => {
  try {
    const result = await accessLogService.endSession({
      userId: req.user.id,
      sessionId: req.body.session_id,
      preserveLastActive: req.body.preserve_last_active === 1 || req.body.preserve_last_active === true
    })
    res.json({ code: 0, message: 'success', data: result })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '退出记录失败', data: null })
  }
})

// Current user profile
router.get('/me', verifyToken, async (req, res) => {
  try {
    const row = await accountService.getCurrentUser(req.user.id)
    if (!row) return res.status(404).json({ code: 404, message: '用户不存在', data: null })
    res.json({ code: 0, message: 'success', data: row })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
})

router.put('/me/profile', verifyToken, async (req, res) => {
  try {
    const row = await accountService.updateProfile(req.user.id, req.body)
    res.json({ code: 0, message: 'success', data: row })
  } catch (err) {
    console.error(err)
    res.status(err.statusCode || 500).json({ code: err.statusCode || 500, message: err.message || '保存失败', data: null })
  }
})

router.put('/me/phone', verifyToken, async (req, res) => {
  try {
    const row = await accountService.changePhone(req.user.id, req.body)
    res.json({ code: 0, message: 'success', data: row })
  } catch (err) {
    console.error(err)
    res.status(err.statusCode || 400).json({ code: err.statusCode || 400, message: err.message || '手机号修改失败', data: null })
  }
})

router.post('/me/avatar', verifyToken, async (req, res) => {
  try {
    const result = await accountService.saveAvatar(req.user.id, req.body)
    res.json({ code: 0, message: 'success', data: result })
  } catch (err) {
    console.error(err)
    res.status(400).json({ code: 400, message: err.message || '头像上传失败', data: null })
  }
})

router.delete('/me/avatar', verifyToken, async (req, res) => {
  try {
    const result = await accountService.resetAvatar(req.user.id)
    res.json({ code: 0, message: 'success', data: result })
  } catch (err) {
    console.error(err)
    res.status(400).json({ code: 400, message: err.message || '头像重置失败', data: null })
  }
})

router.get('/preferences', verifyToken, async (req, res) => {
  try {
    const preference = await accountService.getPreference(req.user.id)
    res.json({ code: 0, message: 'success', data: preference })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
})

router.put('/preferences', verifyToken, async (req, res) => {
  try {
    const preference = await accountService.savePreference(req.user.id, req.body)
    res.json({ code: 0, message: 'success', data: preference })
  } catch (err) {
    console.error(err)
    res.status(400).json({ code: 400, message: err.message || '保存失败', data: null })
  }
})

// Change password
router.put('/password', verifyToken, async (req, res) => {
  try {
    const { old_password, new_password } = req.body
    const userId = req.user.id
    const passwordPayload = accountService.validatePasswordChangePayload({
      oldPassword: old_password,
      newPassword: new_password
    })
    const row = await db.prepare('SELECT password FROM pms_user WHERE id = ? AND is_deleted = 0').get(userId)
    if (!row) {
      return res.status(404).json({ code: 404, message: '用户不存在', data: null })
    }
    const valid = await bcrypt.compare(passwordPayload.oldPassword, row.password)
    if (!valid) {
      return res.status(401).json({ code: 401, message: '原密码错误', data: null })
    }
    const hashed = await bcrypt.hash(passwordPayload.newPassword, 10)
    await db.prepare('UPDATE pms_user SET password = ?, first_login = 0, updated_at = NOW() WHERE id = ?').run(hashed, userId)
    await db.writeLog(userId, '更改密码', '用户', userId, 'password', '***', '***', req.ip)
    res.json({ code: 0, message: '密码修改成功', data: null })
  } catch (err) {
    console.error(err)
    const statusCode = err.statusCode || 500
    res.status(statusCode).json({ code: statusCode, message: err.message || '修改失败', data: null })
  }
})

// Get SSO ticket for AI chatbot embed (requires authentication)
router.post('/sso/ticket', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id
    if (!userId) {
      return res.status(400).json({ code: 400, message: '用户信息异常', data: null })
    }

    // Get employee number from database
    const user = await db.prepare('SELECT employee_no FROM pms_user WHERE id = ? AND is_deleted = 0').get(userId)
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在', data: null })
    }

    const ticket = await requestTicket(user.employee_no)
    res.json({ code: 0, message: 'success', data: { ticket } })
  } catch (err) {
    console.error('SSO ticket error:', err.message)
    res.status(500).json({ code: 500, message: err.message || '获取 ticket 失败', data: null })
  }
})

module.exports = router
