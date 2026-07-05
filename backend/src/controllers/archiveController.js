const db = require('../db')

function withJoins(sql) {
  return `SELECT ${sql}, at.name as archive_type_name, at.code_prefix, u1.real_name as creator_name, u2.real_name as updater_name
    FROM pms_archive a
    LEFT JOIN pms_archive_type at ON a.archive_type_id = at.id
    LEFT JOIN pms_user u1 ON a.creator_id = u1.id
    LEFT JOIN pms_user u2 ON a.updater_id = u2.id`
}

/** Generate next pms_archive code: prefix + 3-digit sequence */
async function generateCode(archiveTypeId) {
  const typeInfo = await db.prepare('SELECT code_prefix FROM pms_archive_type WHERE id = ?').get(archiveTypeId)
  if (!typeInfo) return null
  const prefix = typeInfo.code_prefix
  const maxCode = await db.prepare(
    'SELECT MAX(CAST(SUBSTRING(code FROM ? FOR 20) AS INTEGER)) as max_seq FROM pms_archive WHERE archive_type_id = ? AND code LIKE ?'
  ).get(prefix.length + 1, archiveTypeId, `${prefix}%`)
  const nextSeq = (maxCode?.max_seq || 0) + 1
  return prefix + String(nextSeq).padStart(3, '0')
}

async function getArchiveReferenceMessage(archiveId) {
  const workOrderRefs = await db.prepare(
    `SELECT
      SUM(CASE WHEN system_id = ? THEN 1 ELSE 0 END) as system_count,
      SUM(CASE WHEN problem_type = ? THEN 1 ELSE 0 END) as problem_type_count
    FROM pms_work_order
    WHERE is_deleted = 0
      AND (system_id = ? OR problem_type = ?)`
  ).get(archiveId, archiveId, archiveId, archiveId)

  const referencedFields = []
  if (Number(workOrderRefs?.system_count || 0) > 0) referencedFields.push('所属系统')
  if (Number(workOrderRefs?.problem_type_count || 0) > 0) referencedFields.push('问题类型')

  if (referencedFields.length === 0) return ''
  return `该档案已被运维工单的${referencedFields.join('、')}引用，不能删除`
}

exports.list = async (req, res) => {
  try {
    const { archive_type_id, name, code, status } = req.query
    let sql = withJoins('a.id, a.code, a.name, a.archive_type_id, a.sort_order, a.status, a.creator_id, a.updater_id, a.created_at, a.updated_at')
    sql += ' WHERE a.is_deleted = 0'
    const params = []
    if (archive_type_id) { sql += ' AND a.archive_type_id = ?'; params.push(archive_type_id) }
    if (name) { sql += ' AND a.name LIKE ?'; params.push(`%${name}%`) }
    if (code) { sql += ' AND a.code LIKE ?'; params.push(`%${code}%`) }
    if (status !== undefined && status !== '') { sql += ' AND a.status = ?'; params.push(status) }
    sql += ' ORDER BY a.sort_order ASC, a.id ASC'
    const rows = await db.prepare(sql).all(...params)
    res.json({ code: 0, message: 'success', data: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}

exports.create = async (req, res) => {
  try {
    const { archive_type_id, name, creator_id } = req.body
    const code = await generateCode(archive_type_id)
    if (!code) return res.status(400).json({ code: 400, message: '档案类型不存在', data: null })

    // Auto-calculate sort_order: max existing sort_order + 1 for this type
    const maxSort = await db.prepare('SELECT MAX(sort_order) as max_so FROM pms_archive WHERE archive_type_id = ? AND is_deleted = 0').get(archive_type_id)
    const sort_order = (maxSort?.max_so || 0) + 1

    const result = await db.prepare(
      'INSERT INTO pms_archive (code, name, archive_type_id, sort_order, status, creator_id, updater_id) VALUES (?, ?, ?, ?, 1, ?, ?)'
    ).run(code, name, archive_type_id, sort_order, creator_id || null, creator_id || null)
    await db.writeLog(creator_id, '新增', '档案', result.lastInsertRowid, null, null, JSON.stringify({ code, name, archive_type_id }), req.ip)
    res.json({ code: 0, message: 'success', data: { id: result.lastInsertRowid, code } })
  } catch (err) {
    console.error(err)
    if (err.code === 'ER_DUP_ENTRY' || err.code === '23505') return res.status(400).json({ code: 400, message: '档案编码已存在', data: null })
    res.status(500).json({ code: 500, message: '创建失败', data: null })
  }
}

exports.update = async (req, res) => {
  try {
    const { name, sort_order, updater_id } = req.body
    const old = await db.prepare('SELECT name, sort_order, archive_type_id FROM pms_archive WHERE id = ?').get(req.params.id)
    const changes = []
    if (name !== undefined && String(old.name) !== String(name)) changes.push({ field: 'name', oldVal: old.name, newVal: name })
    if (sort_order !== undefined && Number(old.sort_order) !== Number(sort_order)) changes.push({ field: 'sort_order', oldVal: old.sort_order, newVal: sort_order })
    await db.prepare(
      'UPDATE pms_archive SET name = ?, sort_order = ?, updater_id = ? WHERE id = ?'
    ).run(name || old.name, sort_order !== undefined ? sort_order : old.sort_order, updater_id || null, req.params.id)
    if (updater_id && changes.length > 0) {
      for (const ch of changes) {
        await db.writeLog(updater_id, '编辑', '档案', req.params.id, ch.field, ch.oldVal ?? null, ch.newVal ?? null, req.ip)
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
    const oldStatus = await db.prepare('SELECT status FROM pms_archive WHERE id = ?').get(req.params.id)
    await db.prepare('UPDATE pms_archive SET status = ?, updater_id = ? WHERE id = ?').run(status, updater_id || null, req.params.id)
    if (updater_id) await db.writeLog(updater_id, '状态变更', '档案', req.params.id, 'status', String(oldStatus?.status ?? ''), String(status), req.ip)
    res.json({ code: 0, message: 'success', data: null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '操作失败', data: null })
  }
}

exports.remove = async (req, res) => {
  try {
    const { updater_id } = req.body
    const archiveId = Number(req.params.id)
    const archive = await db.prepare('SELECT id FROM pms_archive WHERE id = ? AND is_deleted = 0').get(archiveId)
    if (!archive) return res.status(404).json({ code: 404, message: '档案不存在或已删除', data: null })

    const referenceMessage = await getArchiveReferenceMessage(archiveId)
    if (referenceMessage) return res.status(400).json({ code: 400, message: referenceMessage, data: null })

    await db.prepare('UPDATE pms_archive SET is_deleted = 1, updater_id = ? WHERE id = ?').run(updater_id || null, archiveId)
    if (updater_id) await db.writeLog(updater_id, '删除', '档案', archiveId, 'is_deleted', '0', '1', req.ip)
    res.json({ code: 0, message: 'success', data: null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '删除失败', data: null })
  }
}

/** Update sort orders in batch (for drag-and-drop reorder) */
exports.batchUpdateSort = async (req, res) => {
  try {
    const { items, updater_id } = req.body // [{ id, sort_order }, ...]
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ code: 400, message: '缺少排序数据', data: null })
    }
    const ids = items.map((item) => Number(item.id)).filter(Boolean)
    if (ids.length === 0) {
      return res.status(400).json({ code: 400, message: '排序数据无效', data: null })
    }

    await db.transaction(async (conn) => {
      const oldRows = await conn.prepare(
        `SELECT id, name, sort_order FROM pms_archive WHERE id IN (${ids.map(() => '?').join(',')}) AND is_deleted = 0`
      ).all(...ids)
      const oldMap = new Map(oldRows.map((row) => [Number(row.id), row]))

      for (const item of items) {
        const archiveId = Number(item.id)
        const nextSortOrder = Number(item.sort_order)
        const old = oldMap.get(archiveId)
        if (!old || Number(old.sort_order) === nextSortOrder) continue

        await conn.prepare('UPDATE pms_archive SET sort_order = ?, updater_id = ?, updated_at = NOW() WHERE id = ?').run(nextSortOrder, updater_id || null, archiveId)
        if (updater_id) {
          await conn.prepare(
            'INSERT INTO pms_op_log (user_id, action, module, target_id, field_name, old_value, new_value, ip, target_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(updater_id, '排序', '档案', archiveId, 'sort_order', old.sort_order, nextSortOrder, req.ip, old.name)
        }
      }
    })
    res.json({ code: 0, message: 'success', data: null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '排序更新失败', data: null })
  }
}

/** Get archives by pms_archive type name (for dropdown reference) */
exports.getByTypeName = async (req, res) => {
  try {
    const { type_name } = req.query
    if (!type_name) return res.status(400).json({ code: 400, message: '缺少类型名称参数', data: null })
    const typeInfo = await db.prepare('SELECT id FROM pms_archive_type WHERE name = ? AND is_deleted = 0').get(type_name)
    if (!typeInfo) return res.json({ code: 0, message: 'success', data: [] })
    const rows = await db.prepare(
      'SELECT a.id, a.code, a.name FROM pms_archive a WHERE a.archive_type_id = ? AND a.is_deleted = 0 AND a.status = 1 ORDER BY a.sort_order ASC'
    ).all(typeInfo.id)
    res.json({ code: 0, message: 'success', data: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}
