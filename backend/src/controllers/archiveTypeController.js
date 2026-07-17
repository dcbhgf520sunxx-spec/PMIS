const db = require('../db')
const { fail, failField } = require('../utils/response')

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
    const { code_prefix, name } = req.body
    const operatorId = req.user.id
    // Auto-generate code: 3-digit sequence based on active records only
    const maxSeq = await db.prepare("SELECT MAX(CAST(code AS INTEGER)) as max_seq FROM pms_archive_type WHERE is_deleted = 0 AND code ~ '^[0-9]+$'").get()
    const nextSeq = (maxSeq?.max_seq || 0) + 1
    const code = String(nextSeq).padStart(3, '0')

    const existsPrefix = await db.prepare('SELECT id FROM pms_archive_type WHERE code_prefix = ? AND is_deleted = 0').get(code_prefix)
    if (existsPrefix) return failField(res, 'code_prefix', '编码前缀已存在')

    const result = await db.prepare(
      'INSERT INTO pms_archive_type (code, code_prefix, name, status, creator_id, updater_id) VALUES (?, ?, ?, 1, ?, ?)'
    ).run(code, code_prefix, name, operatorId, operatorId)
    await db.writeLog(operatorId, '新增', '档案类型', result.lastInsertRowid, null, null, JSON.stringify({ code, code_prefix, name }), req.ip)
    res.json({ code: 0, message: 'success', data: { id: result.lastInsertRowid, code } })
  } catch (err) {
    console.error(err)
    if (err.code === '23505' && String(err.constraint || '').includes('code_prefix')) return failField(res, 'code_prefix', '编码前缀已存在')
    if (err.code === '23505' && String(err.constraint || '').includes('code_active')) return failField(res, 'code_prefix', '档案类型编码生成冲突，请重试')
    res.status(500).json({ code: 500, message: '创建失败', data: null })
  }
}

exports.update = async (req, res) => {
  try {
    const { name } = req.body
    const operatorId = req.user.id
    const old = await db.prepare('SELECT name, code_prefix FROM pms_archive_type WHERE id = ? AND is_deleted = 0').get(req.params.id)
    if (!old) return fail(res, 404, 404, '数据不存在或已被删除')
    const changes = []
    if (name !== undefined && String(old.name) !== String(name)) changes.push({ field: 'name', oldVal: old.name, newVal: name })
    await db.prepare(
      'UPDATE pms_archive_type SET name = ?, updater_id = ?, updated_at = NOW() WHERE id = ?'
    ).run(name || old.name, operatorId, req.params.id)
    if (changes.length > 0) await db.writeLogs(operatorId, '编辑', '档案类型', req.params.id, changes, req.ip)
    res.json({ code: 0, message: 'success', data: null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '更新失败', data: null })
  }
}

exports.toggleStatus = async (req, res) => {
  try {
    const { status } = req.body
    const operatorId = req.user.id
    const oldStatus = await db.prepare('SELECT status FROM pms_archive_type WHERE id = ? AND is_deleted = 0').get(req.params.id)
    if (!oldStatus) return fail(res, 404, 404, '数据不存在或已被删除')
    await db.prepare('UPDATE pms_archive_type SET status = ?, updater_id = ?, updated_at = NOW() WHERE id = ?').run(status, operatorId, req.params.id)
    await db.writeLog(operatorId, '状态变更', '档案类型', req.params.id, 'status', String(oldStatus?.status ?? ''), String(status), req.ip)
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
    const operatorId = req.user.id
    const archiveType = await db.prepare('SELECT id FROM pms_archive_type WHERE id = ? AND is_deleted = 0').get(req.params.id)
    if (!archiveType) return fail(res, 404, 404, '数据不存在或已被删除')
    const refCount = await db.prepare('SELECT COUNT(*) as cnt FROM pms_archive WHERE archive_type_id = ? AND is_deleted = 0').get(req.params.id)
    if (refCount?.cnt > 0) {
      return res.status(400).json({ code: 400, message: '该类型下已有档案数据，不可删除', data: null })
    }
    await db.prepare('UPDATE pms_archive_type SET is_deleted = 1, updater_id = ?, updated_at = NOW() WHERE id = ?').run(operatorId, req.params.id)
    await db.writeLog(operatorId, '删除', '档案类型', req.params.id, 'is_deleted', '0', '1', req.ip)
    res.json({ code: 0, message: 'success', data: null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '删除失败', data: null })
  }
}
