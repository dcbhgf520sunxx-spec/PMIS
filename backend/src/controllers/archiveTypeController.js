const db = require('../db')

function withCreatorUpdater(sql) {
  return `SELECT ${sql}, u1.real_name as creator_name, u2.real_name as updater_name
    FROM pms_archive_type a
    LEFT JOIN pms_user u1 ON a.creator_id = u1.id
    LEFT JOIN pms_user u2 ON a.updater_id = u2.id`
}

exports.list = async (req, res) => {
  try {
    const { name, status } = req.query
    let sql = withCreatorUpdater('a.id, a.code, a.code_prefix, a.name, a.status, a.creator_id, a.updater_id, a.created_at, a.updated_at')
    sql += ' WHERE a.is_deleted = 0'
    const params = []
    if (name) { sql += ' AND a.name LIKE ?'; params.push(`%${name}%`) }
    if (status !== undefined && status !== '') { sql += ' AND a.status = ?'; params.push(status) }
    sql += ' ORDER BY a.created_at DESC'
    const rows = await db.prepare(sql).all(...params)
    res.json({ code: 0, message: 'success', data: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}

exports.create = async (req, res) => {
  try {
    const { code_prefix, name, creator_id } = req.body
    // Auto-generate code: 3-digit sequence based on active records only
    const maxSeq = await db.prepare("SELECT MAX(CAST(code AS INTEGER)) as max_seq FROM pms_archive_type WHERE is_deleted = 0").get()
    const nextSeq = (maxSeq?.max_seq || 0) + 1
    const code = String(nextSeq).padStart(3, '0')

    const existsPrefix = await db.prepare('SELECT id FROM pms_archive_type WHERE code_prefix = ? AND is_deleted = 0').get(code_prefix)
    if (existsPrefix) return res.status(400).json({ code: 400, message: '编码前缀已存在', data: null })

    const result = await db.prepare(
      'INSERT INTO pms_archive_type (code, code_prefix, name, status, creator_id, updater_id) VALUES (?, ?, ?, 1, ?, ?)'
    ).run(code, code_prefix, name, creator_id || null, creator_id || null)
    await db.writeLog(creator_id, '新增', '档案类型', result.lastInsertRowid, null, null, JSON.stringify({ code, code_prefix, name }), req.ip)
    res.json({ code: 0, message: 'success', data: { id: result.lastInsertRowid, code } })
  } catch (err) {
    console.error(err)
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ code: 400, message: '类型编码已存在，请重试', data: null })
    res.status(500).json({ code: 500, message: '创建失败', data: null })
  }
}

exports.update = async (req, res) => {
  try {
    const { name, updater_id } = req.body
    const old = await db.prepare('SELECT name, code_prefix FROM pms_archive_type WHERE id = ?').get(req.params.id)
    const changes = []
    if (name !== undefined && String(old.name) !== String(name)) changes.push({ field: 'name', oldVal: old.name, newVal: name })
    await db.prepare(
      'UPDATE pms_archive_type SET name = ?, updater_id = ? WHERE id = ?'
    ).run(name || old.name, updater_id || null, req.params.id)
    if (updater_id && changes.length > 0) {
      for (const ch of changes) {
        await db.writeLog(updater_id, '编辑', '档案类型', req.params.id, ch.field, ch.oldVal ?? null, ch.newVal ?? null, req.ip)
      }
    }
    res.json({ code: 0, message: 'success', data: null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '更新失败', data: null })
  }
}

exports.toggleStatus = async (req, res) => {
  try {
    const { status, updater_id } = req.body
    const oldStatus = await db.prepare('SELECT status FROM pms_archive_type WHERE id = ?').get(req.params.id)
    await db.prepare('UPDATE pms_archive_type SET status = ?, updater_id = ? WHERE id = ?').run(status, updater_id || null, req.params.id)
    if (updater_id) await db.writeLog(updater_id, '状态变更', '档案类型', req.params.id, 'status', String(oldStatus?.status ?? ''), String(status), req.ip)
    res.json({ code: 0, message: 'success', data: null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '操作失败', data: null })
  }
}

exports.checkPrefix = async (req, res) => {
  try {
    const { prefix, excludeId } = req.query
    if (!prefix) return res.json({ code: 0, data: { available: true } })
    let sql = 'SELECT id FROM pms_archive_type WHERE code_prefix = ? AND is_deleted = 0'
    const params = [prefix]
    if (excludeId) { sql += ' AND id != ?'; params.push(excludeId) }
    const exists = await db.prepare(sql).get(...params)
    res.json({ code: 0, data: { available: !exists } })
  } catch (err) {
    console.error(err)
    res.json({ code: 0, data: { available: true } })
  }
}

exports.remove = async (req, res) => {
  try {
    const { updater_id } = req.body
    const refCount = await db.prepare('SELECT COUNT(*) as cnt FROM pms_archive WHERE archive_type_id = ? AND is_deleted = 0').get(req.params.id)
    if (refCount?.cnt > 0) {
      return res.status(400).json({ code: 400, message: '该类型下已有档案数据，不可删除', data: null })
    }
    await db.prepare('UPDATE pms_archive_type SET is_deleted = 1, updater_id = ? WHERE id = ?').run(updater_id || null, req.params.id)
    if (updater_id) await db.writeLog(updater_id, '删除', '档案类型', req.params.id, 'is_deleted', '0', '1', req.ip)
    res.json({ code: 0, message: 'success', data: null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '删除失败', data: null })
  }
}
