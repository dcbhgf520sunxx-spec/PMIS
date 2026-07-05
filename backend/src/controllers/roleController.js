const db = require('../db')

function resolveRolePermissions(allMenus, roleMenuRows) {
  const normalizedMenus = allMenus.map((menu) => ({
    ...menu,
    id: Number(menu.id),
    parent_id: Number(menu.parent_id),
  }))
  const menuMap = {}
  normalizedMenus.forEach((menu) => { menuMap[menu.id] = menu })

  const menuIds = roleMenuRows.map((row) => Number(row.menu_id))
  const displayIds = menuIds.filter((id) => {
    const menu = menuMap[id]
    if (!menu) return false
    const hasAssignedChild = normalizedMenus.some((child) => child.parent_id === id && menuIds.includes(child.id))
    return !hasAssignedChild
  })

  return displayIds.map((id) => menuMap[id]?.name).filter(Boolean).join('、') || '-'
}

exports.list = async (req, res) => {
  try {
    const { code, name } = req.query
    let sql = `SELECT r.*, u1.real_name as creator_name, u2.real_name as updater_name
      FROM pms_role r
      LEFT JOIN pms_user u1 ON r.creator_id = u1.id
      LEFT JOIN pms_user u2 ON r.updater_id = u2.id
      WHERE r.is_deleted = 0`
    const params = []

    if (code) { sql += ' AND r.code LIKE ?'; params.push(`%${code}%`) }
    if (name) { sql += ' AND r.name LIKE ?'; params.push(`%${name}%`) }

    sql += ' ORDER BY r.created_at DESC'

    const rows = await db.prepare(sql).all(...params)

    // For each role, get assigned menu names (filter out parents that have children assigned)
    const allMenus = await db.prepare('SELECT id, parent_id, name FROM pms_menu WHERE is_deleted = 0').all()

    for (const row of rows) {
      const menuRows = await db.prepare('SELECT menu_id FROM pms_role_menu WHERE role_id = ?').all(row.id)
      row.permissions = resolveRolePermissions(allMenus, menuRows)
    }

    res.json({ code: 0, message: 'success', data: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}

exports.getAll = async (req, res) => {
  try {
    const rows = await db.prepare('SELECT id, code, name FROM pms_role WHERE is_deleted = 0 ORDER BY id').all()
    res.json({ code: 0, message: 'success', data: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}

exports.options = async (req, res) => {
  try {
    const rows = await db.prepare('SELECT id, code, name FROM pms_role WHERE is_deleted = 0 ORDER BY id').all()
    res.json({ code: 0, message: 'success', data: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}

exports.getById = async (req, res) => {
  try {
    const sql = `SELECT r.*, u1.real_name as creator_name, u2.real_name as updater_name
      FROM pms_role r
      LEFT JOIN pms_user u1 ON r.creator_id = u1.id
      LEFT JOIN pms_user u2 ON r.updater_id = u2.id
      WHERE r.id = ? AND r.is_deleted = 0`
    const row = await db.prepare(sql).get(req.params.id)
    if (!row) return res.status(404).json({ code: 404, message: '角色不存在', data: null })
    const allMenus = await db.prepare('SELECT id, parent_id, name FROM pms_menu WHERE is_deleted = 0').all()
    const menuRows = await db.prepare('SELECT menu_id FROM pms_role_menu WHERE role_id = ?').all(row.id)
    row.permissions = resolveRolePermissions(allMenus, menuRows)
    res.json({ code: 0, message: 'success', data: row })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}

exports.create = async (req, res) => {
  try {
    const { code, name, description, creator_id } = req.body
    const result = await db.prepare(
      'INSERT INTO pms_role (code, name, description, creator_id, updater_id) VALUES (?, ?, ?, ?, ?)'
    ).run(code, name, description || null, creator_id || null, creator_id || null)
    await db.writeLog(creator_id, '新增', '角色', result.lastInsertRowid, null, null, JSON.stringify({ code, name, description }), req.ip)
    res.json({ code: 0, message: 'success', data: { id: result.lastInsertRowid } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '创建失败', data: null })
  }
}

exports.update = async (req, res) => {
  try {
    const { code, name, description, updater_id } = req.body
    const old = await db.prepare('SELECT code, name, description FROM pms_role WHERE id = ?').get(req.params.id)

    // Build changes: one entry per changed field
    const changes = []
    for (const key of ['code', 'name', 'description']) {
      const oldVal = old[key]
      const newVal = key === 'description' ? (description || null) : req.body[key]
      if (oldVal !== newVal) {
        changes.push({ field: key, oldVal, newVal })
      }
    }

    if (changes.length > 0) {
      await db.prepare(
        'UPDATE pms_role SET code = ?, name = ?, description = ?, updater_id = ? WHERE id = ?'
      ).run(code, name, description || null, updater_id || null, req.params.id)

      // Write one log entry per changed field
      if (updater_id) {
        const fmt = (v) => v ?? '空'
        for (const ch of changes) {
          await db.writeLog(updater_id, '编辑', '角色', req.params.id, ch.field, fmt(ch.oldVal), fmt(ch.newVal), req.ip)
        }
      }
    }

    res.json({ code: 0, message: 'success', data: null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '更新失败', data: null })
  }
}

exports.remove = async (req, res) => {
  try {
    const { updater_id } = req.body
    const roleId = req.params.id

    // 检查是否有用户关联此角色
    const userCount = await db.prepare('SELECT COUNT(*) as c FROM pms_user_role WHERE role_id = ?').get(roleId)
    if (userCount.c > 0) {
      return res.status(400).json({ code: 400, message: '该角色下有用户关联，无法删除', data: null })
    }

    await db.prepare('UPDATE pms_role SET is_deleted = 1, updater_id = ? WHERE id = ?').run(updater_id || null, roleId)
    if (updater_id) await db.writeLog(updater_id, '删除', '角色', roleId, 'is_deleted', '0', '1', req.ip)
    res.json({ code: 0, message: 'success', data: null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '删除失败', data: null })
  }
}

exports.checkCode = async (req, res) => {
  try {
    const { code, excludeId } = req.query
    if (!code) return res.json({ code: 0, data: { available: true } })
    let sql = 'SELECT COUNT(*) as cnt FROM pms_role WHERE code = ? AND is_deleted = 0'
    const params = [code]
    if (excludeId) { sql += ' AND id != ?'; params.push(excludeId) }
    const { cnt } = await db.prepare(sql).get(...params)
    res.json({ code: 0, data: { available: Number(cnt) === 0 } })
  } catch (err) {
    console.error(err)
    res.json({ code: 0, data: { available: true } })
  }
}
