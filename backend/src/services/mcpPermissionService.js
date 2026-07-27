const db = require('../db')

async function getAllowedMenuPaths(userId, database = db) {
  const rows = await database.prepare(`
    SELECT DISTINCT m.path
    FROM pms_menu m
    JOIN pms_role_menu rm ON rm.menu_id = m.id
    JOIN pms_user_role ur ON ur.role_id = rm.role_id
    WHERE ur.user_id = ? AND m.is_deleted = 0 AND m.status = 1
  `).all(userId)
  return new Set(rows.map((row) => row.path).filter(Boolean))
}

function hasMenuPermission(allowedMenuPaths, menuPath) {
  return allowedMenuPaths instanceof Set && allowedMenuPaths.has(menuPath)
}

module.exports = { getAllowedMenuPaths, hasMenuPermission }
