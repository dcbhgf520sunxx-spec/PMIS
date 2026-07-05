const db = require('../db')
const bcrypt = require('bcryptjs')

function withCreatorUpdater(sql) {
  return `SELECT ${sql}, u1.real_name as creator_name, u2.real_name as updater_name
    FROM pms_user
    LEFT JOIN pms_user u1 ON pms_user.creator_id = u1.id
    LEFT JOIN pms_user u2 ON pms_user.updater_id = u2.id`
}

exports.list = async (req, res) => {
  try {
    const { employee_no, real_name, phone, status, role_ids } = req.query
    let baseSql = withCreatorUpdater('pms_user.id, pms_user.employee_no, pms_user.real_name, pms_user.phone, pms_user.status, pms_user.creator_id, pms_user.updater_id, pms_user.created_at, pms_user.updated_at')

    let sql, params = []
    const ids = role_ids ? (Array.isArray(role_ids) ? role_ids : role_ids.split(',').map(Number).filter(Boolean)) : []

    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',')
      sql = `SELECT pu.*, u1.real_name as creator_name, u2.real_name as updater_name FROM pms_user pu
        INNER JOIN pms_user_role ur ON pu.id = ur.user_id
        LEFT JOIN pms_user u1 ON pu.creator_id = u1.id
        LEFT JOIN pms_user u2 ON pu.updater_id = u2.id
        WHERE pu.is_deleted = 0 AND ur.role_id IN (${placeholders})`
      params.push(...ids)
      if (employee_no) { sql += ' AND pu.employee_no LIKE ?'; params.push(`%${employee_no}%`) }
      if (real_name) { sql += ' AND pu.real_name LIKE ?'; params.push(`%${real_name}%`) }
      if (phone) { sql += ' AND pu.phone LIKE ?'; params.push(`%${phone}%`) }
      if (status !== undefined && status !== '') { sql += ' AND pu.status = ?'; params.push(status) }
    } else {
      sql = baseSql + ' WHERE pms_user.is_deleted = 0'
      if (employee_no) { sql += ' AND pms_user.employee_no LIKE ?'; params.push(`%${employee_no}%`) }
      if (real_name) { sql += ' AND pms_user.real_name LIKE ?'; params.push(`%${real_name}%`) }
      if (phone) { sql += ' AND pms_user.phone LIKE ?'; params.push(`%${phone}%`) }
      if (status !== undefined && status !== '') { sql += ' AND pms_user.status = ?'; params.push(status) }
    }

    sql += ' ORDER BY created_at DESC'

    const rows = await db.prepare(sql).all(...params)
    const getRoles = db.prepare(`SELECT r.id, r.name FROM pms_user_role ur LEFT JOIN pms_role r ON ur.role_id = r.id WHERE ur.user_id = ? ORDER BY r.id`)
    for (const row of rows) { row.roles = await getRoles.all(row.id) }

    res.json({ code: 0, message: 'success', data: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}

exports.options = async (req, res) => {
  try {
    const rows = await db.prepare(
      'SELECT id, employee_no, real_name FROM pms_user WHERE status = 1 AND is_deleted = 0 ORDER BY employee_no, id'
    ).all()

    res.json({ code: 0, message: 'success', data: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}

exports.getById = async (req, res) => {
  try {
    const sql = withCreatorUpdater('pms_user.id, pms_user.employee_no, pms_user.real_name, pms_user.phone, pms_user.status, pms_user.creator_id, pms_user.updater_id, pms_user.created_at, pms_user.updated_at')
    const row = await db.prepare(sql + ' WHERE pms_user.id = ? AND pms_user.is_deleted = 0').get(req.params.id)
    if (!row) return res.status(404).json({ code: 404, message: '用户不存在', data: null })
    const roleRows = await db.prepare(`
      SELECT ur.role_id, r.name
      FROM pms_user_role ur
      LEFT JOIN pms_role r ON ur.role_id = r.id
      WHERE ur.user_id = ?
      ORDER BY ur.role_id
    `).all(row.id)
    row.role_ids = roleRows.map(r => r.role_id)
    row.roles = roleRows.map(r => ({ id: r.role_id, name: r.name })).filter(r => r.name)
    res.json({ code: 0, message: 'success', data: row })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}

exports.create = async (req, res) => {
  try {
    const { employee_no, real_name, phone, password, status, role_ids, creator_id } = req.body

    if (employee_no) {
      const exists = await db.prepare('SELECT id FROM pms_user WHERE employee_no = ? AND is_deleted = 0').get(employee_no)
      if (exists) return res.status(400).json({ code: 400, message: '工号已存在', data: null })
    }
    if (phone) {
      const exists = await db.prepare('SELECT id FROM pms_user WHERE phone = ? AND is_deleted = 0').get(phone)
      if (exists) return res.status(400).json({ code: 400, message: '手机号已存在', data: null })
    }

    const hashedPassword = await bcrypt.hash(password || 'vv123456', 10)

    let userId
    await db.transaction(async (conn) => {
      const result = await conn.prepare(
        'INSERT INTO pms_user (employee_no, real_name, phone, password, status, first_login, creator_id, updater_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(employee_no, real_name, phone || null, hashedPassword, status || 1, 1, creator_id || null, creator_id || null)
      userId = result.lastInsertRowid

      if (role_ids && role_ids.length > 0) {
        const insertRole = conn.prepare('INSERT INTO pms_user_role (user_id, role_id) VALUES (?, ?) ON CONFLICT (user_id, role_id) DO NOTHING')
        for (const rid of role_ids) {
          await insertRole.run(userId, rid)
        }
      }

      await db.writeLog(creator_id, '新增', '用户', userId, null, null, JSON.stringify({ employee_no, real_name, phone }), req.ip)
    })

    res.json({ code: 0, message: 'success', data: { id: userId } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '创建失败', data: null })
  }
}

exports.update = async (req, res) => {
  try {
    const { employee_no, real_name, phone, password, status, role_ids, updater_id } = req.body

    const old = await db.prepare('SELECT employee_no, real_name, phone, status FROM pms_user WHERE id = ?').get(req.params.id)

    if (phone) {
      const exists = await db.prepare('SELECT id FROM pms_user WHERE phone = ? AND is_deleted = 0 AND id != ?').get(phone, req.params.id)
      if (exists) return res.status(400).json({ code: 400, message: '手机号已存在', data: null })
    }

    // Build changes: one entry per changed field
    const fieldsToCompare = ['employee_no', 'real_name', 'phone']
    if (status !== undefined) fieldsToCompare.push('status')

    const changes = []
    for (const key of fieldsToCompare) {
      const oldVal = old[key]
      let newVal
      if (key === 'phone') newVal = phone || null
      else if (key === 'status') newVal = status
      else newVal = req.body[key]
      if (oldVal !== newVal) {
        changes.push({ field: key, oldVal, newVal })
      }
    }

    const oldRoleIds = (await db.prepare('SELECT role_id FROM pms_user_role WHERE user_id = ?').all(req.params.id)).map(r => r.role_id)
    const newRoleIds = role_ids || []
    if (JSON.stringify(oldRoleIds.sort()) !== JSON.stringify(newRoleIds.sort())) {
      changes.push({ field: 'role_ids', oldVal: oldRoleIds, newVal: newRoleIds })
    }

    await db.transaction(async (conn) => {
      if (status === undefined) {
        if (password) {
          const hashed = await bcrypt.hash(password, 10)
          await conn.prepare(
            'UPDATE pms_user SET employee_no = ?, real_name = ?, phone = ?, password = ?, updater_id = ? WHERE id = ?'
          ).run(employee_no, real_name, phone || null, hashed, updater_id || null, req.params.id)
        } else {
          await conn.prepare(
            'UPDATE pms_user SET employee_no = ?, real_name = ?, phone = ?, updater_id = ? WHERE id = ?'
          ).run(employee_no, real_name, phone || null, updater_id || null, req.params.id)
        }
      } else {
        if (password) {
          const hashed = await bcrypt.hash(password, 10)
          await conn.prepare(
            'UPDATE pms_user SET employee_no = ?, real_name = ?, phone = ?, password = ?, status = ?, updater_id = ? WHERE id = ?'
          ).run(employee_no, real_name, phone || null, hashed, status, updater_id || null, req.params.id)
        } else {
          await conn.prepare(
            'UPDATE pms_user SET employee_no = ?, real_name = ?, phone = ?, status = ?, updater_id = ? WHERE id = ?'
          ).run(employee_no, real_name, phone || null, status, updater_id || null, req.params.id)
        }
      }

      await conn.prepare('DELETE FROM pms_user_role WHERE user_id = ?').run(req.params.id)
      for (const rid of newRoleIds) {
        await conn.prepare('INSERT INTO pms_user_role (user_id, role_id) VALUES (?, ?) ON CONFLICT (user_id, role_id) DO NOTHING').run(req.params.id, rid)
      }

      // One log entry per changed field
      if (updater_id) {
        const fmt = (v) => Array.isArray(v) ? `[${v.join(',')}]` : (v ?? '空')
        for (const ch of changes) {
          await db.writeLog(updater_id, '编辑', '用户', req.params.id, ch.field, fmt(ch.oldVal), fmt(ch.newVal), req.ip)
        }
      }
    })

    res.json({ code: 0, message: 'success', data: null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '更新失败', data: null })
  }
}

exports.remove = async (req, res) => {
  try {
    const { updater_id } = req.body
    const userId = req.params.id

    // 检查是否有角色关联
    const roleRef = await db.prepare('SELECT COUNT(*) as cnt FROM pms_user_role WHERE user_id = ?').get(userId)
    if (roleRef?.cnt > 0) {
      return res.status(400).json({ code: 400, message: '该用户已分配角色，无法删除', data: null })
    }

    // 检查是否作为跟踪人被工单引用
    const woRef = await db.prepare('SELECT COUNT(*) as cnt FROM pms_work_order WHERE follower_id = ? AND is_deleted = 0').get(userId)
    if (woRef?.cnt > 0) {
      return res.status(400).json({ code: 400, message: '该用户已被运维工单引用为跟踪人，无法删除', data: null })
    }

    await db.prepare('UPDATE pms_user SET is_deleted = 1, updater_id = ? WHERE id = ?').run(updater_id || null, userId)
    if (updater_id) await db.writeLog(updater_id, '删除', '用户', userId, 'is_deleted', '0', '1', req.ip)
    res.json({ code: 0, message: 'success', data: null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '删除失败', data: null })
  }
}

exports.toggleStatus = async (req, res) => {
  try {
    const { status, updater_id } = req.body
    const oldStatus = await db.prepare('SELECT status FROM pms_user WHERE id = ?').get(req.params.id)
    await db.prepare('UPDATE pms_user SET status = ?, updater_id = ? WHERE id = ?').run(status, updater_id || null, req.params.id)
    if (updater_id) await db.writeLog(updater_id, '状态变更', '用户', req.params.id, 'status', String(oldStatus?.status ?? ''), String(status), req.ip)
    res.json({ code: 0, message: 'success', data: null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '操作失败', data: null })
  }
}

exports.resetPassword = async (req, res) => {
  try {
    const { updater_id } = req.body
    const hashed = await bcrypt.hash('vv123456', 10)
    await db.prepare('UPDATE pms_user SET password = ?, updater_id = ? WHERE id = ?').run(hashed, updater_id || null, req.params.id)
    if (updater_id) await db.writeLog(updater_id, '重置密码', '用户', req.params.id, 'password', '***', 'vv123456', req.ip)
    res.json({ code: 0, message: 'success', data: null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '操作失败', data: null })
  }
}

exports.checkPhone = async (req, res) => {
  try {
    const { phone, excludeId } = req.query
    if (!phone) return res.json({ code: 0, message: 'success', data: { available: true } })
    let sql = 'SELECT id FROM pms_user WHERE phone = ? AND is_deleted = 0'
    const params = [phone]
    if (excludeId) { sql += ' AND id != ?'; params.push(excludeId) }
    const exists = await db.prepare(sql).get(...params)
    res.json({ code: 0, message: 'success', data: { available: !exists } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}

exports.checkEmployeeNo = async (req, res) => {
  try {
    const { employee_no, excludeId } = req.query
    if (!employee_no) return res.json({ code: 0, message: 'success', data: { available: true } })
    let sql = 'SELECT id FROM pms_user WHERE employee_no = ? AND is_deleted = 0'
    const params = [employee_no]
    if (excludeId) { sql += ' AND id != ?'; params.push(excludeId) }
    const exists = await db.prepare(sql).get(...params)
    res.json({ code: 0, message: 'success', data: { available: !exists } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}

/** 从外部 HR 系统搜索人员 */
exports.hrSearch = async (req, res) => {
  try {
    const { keyword } = req.query
    if (!keyword || keyword.trim().length < 1) return res.json({ code: 0, message: 'success', data: [] })
    const HR_URL = process.env.HR_API_URL || 'http://172.16.0.45:8500'
    const response = await fetch(`${HR_URL}/shr/person/byCode?finService=1`)
    if (!response.ok) return res.status(502).json({ code: 502, message: 'HR系统暂不可用', data: [] })
    const body = await response.json()
    const kw = keyword.trim().toLowerCase()
    const persons = (body.data || []).filter(p => (p.code && p.code.toLowerCase().includes(kw)) || (p.userName && p.userName.toLowerCase().includes(kw))).slice(0, 20).map(p => ({ employee_no: p.code, real_name: p.userName, phone: p.phone || '' }))
    res.json({ code: 0, message: 'success', data: persons })
  } catch (err) {
    console.error('HR search error:', err)
    res.status(502).json({ code: 502, message: 'HR系统暂不可用', data: [] })
  }
}
