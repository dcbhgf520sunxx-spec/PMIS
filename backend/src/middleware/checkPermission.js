const db = require('../db')

/**
 * 菜单权限校验中间件
 * 根据菜单路径动态查询 pms_role_menu，判断用户角色是否有该菜单权限
 * @param {string} menuPath - 菜单路径，如 '/users'、'/roles'
 * @returns {Function} Express 中间件
 */
function createPermissionChecker(lookupSql, value) {
  return async (req, res, next) => {
    try {
      const user = req.user // verifyToken 中间件已注入，字段为 id
      const menuRow = await db.prepare(lookupSql).get(value)
      if (!menuRow) {
        return res.status(403).json({ code: 403, message: '权限不足', data: null })
      }
      const rows = await db.prepare(
        'SELECT 1 FROM pms_role_menu WHERE role_id IN (SELECT role_id FROM pms_user_role WHERE user_id = ?) AND menu_id = ?'
      ).all(user.id, menuRow.id)
      if (!rows.length) {
        return res.status(403).json({ code: 403, message: '权限不足', data: null })
      }
      next()
    } catch (err) {
      console.error(err)
      res.status(500).json({ code: 500, message: '权限校验失败', data: null })
    }
  }
}

function checkPermission(menuPath) {
  return createPermissionChecker('SELECT id FROM pms_menu WHERE path = ? AND is_deleted = 0 AND status = 1', menuPath)
}

function checkPermissionCode(permissionCode) {
  return createPermissionChecker('SELECT id FROM pms_menu WHERE code = ? AND is_deleted = 0 AND status = 1', permissionCode)
}

module.exports = { checkPermission, checkPermissionCode }
