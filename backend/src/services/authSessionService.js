const jwt = require('jsonwebtoken')
const defaultDb = require('../db')
const defaultAccessLogService = require('./accessLogService')
const { includeParentMenus } = require('./menuHierarchy')

function createAuthSessionService({
  db = defaultDb,
  accessLogService = defaultAccessLogService,
  jwtSecret = process.env.JWT_SECRET
} = {}) {
  async function createSession({ user, account, req, authMethod = 'password' }) {
    const menus = await db.prepare(`
      SELECT DISTINCT m.*
      FROM pms_menu m
      INNER JOIN pms_role_menu rm ON m.id = rm.menu_id
      INNER JOIN pms_user_role ur ON rm.role_id = ur.role_id
      WHERE ur.user_id = ? AND m.is_deleted = 0 AND m.status = 1
      ORDER BY m.sort_order, m.id
    `).all(user.id)

    const homeMenu = await db.prepare(
      "SELECT * FROM pms_menu WHERE path = '/home' AND is_deleted = 0 AND status = 1"
    ).get()
    if (homeMenu && !menus.some((menu) => menu.id === homeMenu.id)) {
      menus.push(homeMenu)
      menus.sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id))
    }

    const allMenus = await db.prepare('SELECT * FROM pms_menu WHERE is_deleted = 0').all()
    const resolvedMenus = includeParentMenus(menus, allMenus)
    const roles = await db.prepare(`
      SELECT r.code FROM pms_user_role ur
      INNER JOIN pms_role r ON r.id = ur.role_id
      WHERE ur.user_id = ? AND r.is_deleted = 0
    `).all(user.id)
    const accessSessionId = await accessLogService.recordLoginSuccess({ user, account, req })
    if (!accessSessionId) throw new Error('登录会话创建失败')

    const token = jwt.sign(
      {
        userId: user.id,
        employeeNo: user.employee_no,
        sessionId: accessSessionId,
        authMethod
      },
      jwtSecret,
      { expiresIn: '24h' }
    )

    return {
      token,
      first_login: authMethod === 'wecom' ? 0 : user.first_login,
      access_session_id: accessSessionId,
      user: {
        id: user.id,
        employee_no: user.employee_no,
        real_name: user.real_name,
        phone: user.phone,
        avatar_url: user.avatar_url,
        roles: roles.map((item) => item.code)
      },
      menus: resolvedMenus
    }
  }

  return { createSession }
}

module.exports = { createAuthSessionService }
