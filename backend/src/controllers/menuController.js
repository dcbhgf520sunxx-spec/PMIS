const db = require('../db')

exports.saveRoleMenus = async (req, res) => {
  try {
    const roleId = req.params.roleId
    const { menuIds, updater_id } = req.body

    // Get old menu ids (sorted for comparison)
    const oldRows = await db.prepare('SELECT menu_id FROM pms_role_menu WHERE role_id = ?').all(roleId)
    const oldMenuIds = oldRows.map(r => r.menu_id).sort()

    // New menu ids - only store what user checked, don't auto-include parents
    const newMenuIds = (menuIds || []).sort()

    // Check if menus actually changed (both sorted)
    const hasChanged = JSON.stringify(oldMenuIds) !== JSON.stringify(newMenuIds)

    await db.transaction(async (conn) => {
      await conn.prepare('DELETE FROM pms_role_menu WHERE role_id = ?').run(roleId)
      const stmt = conn.prepare('INSERT INTO pms_role_menu (role_id, menu_id, created_at) VALUES (?, ?, NOW())')
      for (const menuId of newMenuIds) {
        await stmt.run(roleId, menuId)
      }

      // Only write log if menus actually changed
      if (hasChanged && updater_id) {
        const oldValue = oldMenuIds.join('、') || '无'
        const newValue = newMenuIds.join('、') || '无'
        await db.writeLog(updater_id, '分配权限', '角色', roleId, 'menu_ids', oldValue, newValue, req.ip)
      }
    })
    res.json({ code: 0, message: 'success', data: null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '保存失败', data: null })
  }
}

// Get user menus (auto-include parent dirs for tree rendering)
exports.getUserMenus = async (req, res) => {
  try {
    const userId = req.params.userId || req.query.userId
    if (!userId) return res.status(400).json({ code: 400, message: '缺少用户ID', data: null })

    const rows = await db.prepare(`
      SELECT DISTINCT m.*
      FROM pms_menu m
      INNER JOIN pms_role_menu rm ON m.id = rm.menu_id
      INNER JOIN pms_user_role ur ON rm.role_id = ur.role_id
      WHERE ur.user_id = ? AND m.is_deleted = 0 AND m.status = 1
      ORDER BY m.sort_order, m.id
    `).all(userId)

    // Auto-include parent menus for tree rendering
    const allMenuIds = new Set(rows.map(r => r.id))
    const allMenus = await db.prepare('SELECT * FROM pms_menu WHERE is_deleted = 0').all()
    const menuMap = {}
    allMenus.forEach(m => { menuMap[m.id] = m })

    const toProcess = [...allMenuIds]
    while (toProcess.length > 0) {
      const id = toProcess.pop()
      const parentId = menuMap[id]
      if (parentId && parentId !== 0 && !allMenuIds.has(parentId)) {
        const parent = menuMap[parentId]
        if (parent) {
          rows.push(parent)
          allMenuIds.add(parentId)
          toProcess.push(parentId)
        }
      }
    }

    res.json({ code: 0, message: 'success', data: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}

exports.getRoleMenus = async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT menu_id FROM pms_role_menu WHERE role_id = ?
    `).all(req.params.roleId)
    res.json({ code: 0, message: 'success', data: rows.map(r => r.menu_id) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}

// Get all menus (for tree display in role editor)
exports.list = async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT * FROM pms_menu WHERE is_deleted = 0 ORDER BY sort_order, id
    `).all()
    res.json({ code: 0, message: 'success', data: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}
