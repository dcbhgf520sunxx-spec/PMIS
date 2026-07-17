const jwt = require('jsonwebtoken')
const db = require('../db')
const accessLogService = require('../services/accessLogService')
const { fail } = require('../utils/response')

const FIRST_LOGIN_ALLOWED_PATHS = new Set([
  '/api/auth/password',
  '/api/auth/logout',
  '/api/auth/heartbeat'
])

/**
 * JWT 身份验证中间件
 * - 验证请求头中的 Authorization Bearer Token
 * - 验证通过：将用户信息挂载到 req.user，放行
 * - 验证失败：返回 401 拒绝访问
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(res, 401, 401, '未登录，请先登录')
  }

  const token = authHeader.slice(7)

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!await accessLogService.isSessionActive({ userId: decoded.userId, sessionId: decoded.sessionId })) {
      return fail(res, 401, 401, '登录已失效，请重新登录')
    }

    // 停用或软删除不主动撤销已签发会话；这里只读取首次登录标记。
    const user = await db.prepare('SELECT first_login FROM pms_user WHERE id = ?').get(decoded.userId)
    if (!user) {
      return fail(res, 401, 401, '登录已失效，请重新登录')
    }

    req.user = {
      id: decoded.userId,
      employeeNo: decoded.employeeNo,
      sessionId: decoded.sessionId,
      firstLogin: Number(user.first_login) === 1,
    }

    const requestPath = req.originalUrl.split('?')[0]
    if (req.user.firstLogin && !FIRST_LOGIN_ALLOWED_PATHS.has(requestPath)) {
      return fail(res, 403, 403, '首次登录请先修改密码')
    }
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return fail(res, 401, 401, '登录已过期，请重新登录')
    }
    return fail(res, 401, 401, '无效的登录凭证')
  }
}

module.exports = { verifyToken }
