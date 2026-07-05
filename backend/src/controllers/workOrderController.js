const db = require('../db')
const { calcOverdue } = require('../utils/calcOverdue')
const { refreshOverdueStatus } = require('../services/overdueCron')

function withJoins(sql) {
  return `SELECT ${sql}, u1.real_name as creator_name, u2.real_name as updater_name, u3.real_name as follower_name,
      sys.name as system_name, pt.name as problem_type_name
    FROM pms_work_order w
    LEFT JOIN pms_user u1 ON w.creator_id = u1.id
    LEFT JOIN pms_user u2 ON w.updater_id = u2.id
    LEFT JOIN pms_user u3 ON w.follower_id = u3.id
    LEFT JOIN pms_archive sys ON w.system_id = sys.id
    LEFT JOIN pms_archive pt ON w.problem_type = pt.id`
}

/** Build WHERE clause and params for work order filtering (shared by list and neighbors) */
function buildWhereClause(q) {
  let sql = ' WHERE w.is_deleted = 0'
  const params = []
  if (q.problem_desc) { sql += ' AND w.problem_desc LIKE ?'; params.push(`%${q.problem_desc}%`) }
  if (q.system_id) { sql += ' AND w.system_id = ?'; params.push(q.system_id) }
  if (q.problem_type !== undefined && q.problem_type !== '') { sql += ' AND w.problem_type = ?'; params.push(q.problem_type) }
  if (q.urgency !== undefined && q.urgency !== '') { sql += ' AND w.urgency = ?'; params.push(q.urgency) }
  if (q.status !== undefined && q.status !== '') { sql += ' AND w.status = ?'; params.push(q.status) }
  if (q.is_overdue !== undefined && q.is_overdue !== '') { sql += ' AND w.is_overdue = ?'; params.push(q.is_overdue) }
  if (q.follower_id) { sql += ' AND w.follower_id = ?'; params.push(q.follower_id) }
  if (q.submitter_name) { sql += ' AND w.submitter_name LIKE ?'; params.push(`%${q.submitter_name}%`) }
  if (q.submit_time_from) { sql += ' AND w.submit_time >= ?'; params.push(q.submit_time_from) }
  if (q.submit_time_to) { sql += ' AND w.submit_time <= ?'; params.push(q.submit_time_to) }
  if (q.expected_resolve_date_from) { sql += ' AND w.expected_resolve_date >= ?'; params.push(q.expected_resolve_date_from) }
  if (q.expected_resolve_date_to) { sql += ' AND w.expected_resolve_date <= ?'; params.push(q.expected_resolve_date_to) }
  return { sql, params }
}

exports.list = async (req, res) => {
  try {
    const q = { ...req.query }
    let sql = withJoins('w.id, w.system_id, w.problem_type, w.problem_desc, w.result_desc, w.follower_id, w.urgency, w.status, w.is_overdue, w.expected_resolve_date, w.resolve_date, w.close_date, w.submitter_name, w.submitter_dept, w.submit_time, w.created_at')
    const { sql: whereSql, params } = buildWhereClause(q)
    sql += whereSql

    // 支持排序参数（与 neighbors 逻辑一致）
    const sortMap = {
      problem_desc: 'w.problem_desc', system_id: 'sys.name', problem_type: 'pt.name', urgency: 'w.urgency', status: 'w.status',
      is_overdue: 'w.is_overdue', follower_name: 'w.follower_id', follower_id: 'w.follower_id',
      submitter_name: 'w.submitter_name', submitter_dept: 'w.submitter_dept',
      submit_time: 'w.submit_time', expected_resolve_date: 'w.expected_resolve_date',
      creator_name: null, created_at: 'w.created_at',
    }
    let sortCol = 'w.created_at'
    let sortDir = 'DESC'
    if (q.sort_field && sortMap[q.sort_field] !== undefined) {
      const mapped = sortMap[q.sort_field]
      if (mapped) {
        sortCol = mapped
        sortDir = q.sort_order === 'asc' ? 'ASC' : 'DESC'
      }
    }
    sql += ` ORDER BY ${sortCol} ${sortDir}, w.id ${sortDir}`

    const rows = await db.prepare(sql).all(...params)
    res.json({ code: 0, message: 'success', data: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}

exports.refreshOverdue = async (req, res) => {
  try {
    const result = await refreshOverdueStatus()
    res.json({ code: 0, message: 'success', data: result })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '逾期检查失败', data: null })
  }
}

exports.getById = async (req, res) => {
  try {
    const sql = withJoins('w.id, w.system_id, w.problem_type, w.problem_desc, w.result_desc, w.follower_id, w.urgency, w.status, w.is_overdue, w.expected_resolve_date, w.resolve_date, w.close_date, w.submitter_name, w.submitter_dept, w.submit_time, w.creator_id, w.updater_id, w.created_at, w.updated_at')
    const row = await db.prepare(sql + ' WHERE w.id = ? AND w.is_deleted = 0').get(req.params.id)
    if (!row) return res.status(404).json({ code: 404, message: '工单不存在', data: null })
    res.json({ code: 0, message: 'success', data: row })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}

exports.create = async (req, res) => {
  try {
    const { system_id, problem_type, problem_desc, follower_id, urgency, status, expected_resolve_date, submitter_name, submitter_dept, submit_time, creator_id } = req.body

    // Validate problem_desc uniqueness
    if (problem_desc) {
      const exists = await db.prepare('SELECT id FROM pms_work_order WHERE problem_desc = ? AND is_deleted = 0').get(problem_desc)
      if (exists) return res.status(400).json({ code: 400, message: '问题描述已存在，请勿重复创建', data: null })
    }

    const finalStatus = status !== undefined ? status : 0
    const is_overdue = calcOverdue(expected_resolve_date, finalStatus)

    const result = await db.prepare(
      'INSERT INTO pms_work_order (system_id, problem_type, problem_desc, follower_id, urgency, status, is_overdue, expected_resolve_date, submitter_name, submitter_dept, submit_time, creator_id, updater_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(system_id || null, problem_type || null, problem_desc || null, follower_id || null, urgency ?? 1, finalStatus, is_overdue, expected_resolve_date || null, submitter_name || null, submitter_dept || null, submit_time || null, creator_id || null, creator_id || null)

    await db.writeLog(creator_id, '新增', '运维工单', result.lastInsertRowid, null, null, JSON.stringify({ system_id, problem_type, follower_id, urgency }), req.ip)
    res.json({ code: 0, message: 'success', data: { id: result.lastInsertRowid } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '创建失败', data: null })
  }
}

exports.update = async (req, res) => {
  try {
    const { system_id, problem_type, problem_desc, result_desc, follower_id, urgency, status, expected_resolve_date, resolve_date, close_date, submitter_name, submitter_dept, submit_time, updater_id } = req.body

    const old = await db.prepare('SELECT system_id, problem_type, problem_desc, result_desc, follower_id, urgency, status, expected_resolve_date, resolve_date, close_date, submitter_name, submitter_dept, submit_time FROM pms_work_order WHERE id = ?').get(req.params.id)

    const changes = []
    const trackedFields = ['problem_desc', 'system_id', 'problem_type', 'urgency', 'status', 'is_overdue', 'follower_id', 'submitter_name', 'submitter_dept', 'submit_time', 'expected_resolve_date', 'resolve_date', 'close_date', 'result_desc']
    // Date fields that may come as YYYY-MM-DD from frontend but stored as YYYY-MM-DD 00:00:00 in DB
    const dateFields = new Set(['expected_resolve_date', 'resolve_date', 'close_date', 'submit_time'])
    for (const key of trackedFields) {
      if (req.body[key] === undefined) continue
      let oldVal = old[key]
      const newVal = req.body[key]
      // Normalize date comparison: strip trailing 00:00:00 if new value is date-only
      if (dateFields.has(key) && oldVal && !String(newVal ?? '').includes(' ')) {
        oldVal = String(oldVal).slice(0, 10)
      }
      if (String(oldVal ?? '') !== String(newVal ?? '')) {
        changes.push({ field: key, oldVal, newVal })
      }
    }

    // Build dynamic SET clause
    const setParts = []
    const params = []

    const fieldMap = {
      system_id, problem_type, problem_desc, result_desc, follower_id, urgency,
      expected_resolve_date, resolve_date, close_date, submitter_name, submitter_dept, submit_time,
    }

    for (const [key, val] of Object.entries(fieldMap)) {
      if (val === undefined) continue
      setParts.push(`${key} = ?`)
      params.push(val === null ? null : val)
    }

    // Handle status if provided
    if (status !== undefined) {
      setParts.push('status = ?')
      params.push(status)
    }

    // Recalculate is_overdue
    const finalStatus = status !== undefined ? status : old.status
    const finalExpectedDate = expected_resolve_date !== undefined ? expected_resolve_date : old.expected_resolve_date
    const is_overdue = calcOverdue(finalExpectedDate, finalStatus)
    if (is_overdue !== old.is_overdue) {
      changes.push({ field: 'is_overdue', oldVal: old.is_overdue, newVal: is_overdue })
    }
    setParts.push('is_overdue = ?')
    params.push(is_overdue)

    setParts.push('updater_id = ?')
    params.push(updater_id || null)
    params.push(req.params.id)

    const sql = `UPDATE pms_work_order SET ${setParts.join(', ')} WHERE id = ?`
    await db.prepare(sql).run(...params)

    if (updater_id && changes.length > 0) {
      for (const ch of changes) {
        await db.writeLog(updater_id, '编辑', '运维工单', req.params.id, ch.field, ch.oldVal ?? null, ch.newVal ?? null, req.ip)
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
    const { status, updater_id, resolve_date, close_date, result_desc } = req.body
    const old = await db.prepare('SELECT status, is_overdue, expected_resolve_date, resolve_date, close_date, result_desc FROM pms_work_order WHERE id = ?').get(req.params.id)
    const changes = []

    const statusDateFields = new Set(['resolve_date', 'close_date'])
    const normalizeChangeValue = (field, value) => {
      if (value === null || value === undefined) return ''
      if (statusDateFields.has(field)) return String(value).replace('T', ' ').slice(0, 10)
      return String(value)
    }
    const sameValue = (field, a, b) => normalizeChangeValue(field, a) === normalizeChangeValue(field, b)
    const addChange = (field, oldVal, newVal) => {
      if (!sameValue(field, oldVal, newVal)) {
        changes.push({ field, oldVal, newVal })
      }
    }

    addChange('status', old?.status, status)

    // Recalculate is_overdue
    const is_overdue = calcOverdue(old?.expected_resolve_date, status)
    addChange('is_overdue', old?.is_overdue, is_overdue)

    // 已关闭恢复到非已完成：关闭时间、实际修复时间、处置结果都清空。
    // 已关闭恢复到已完成：关闭时间清空，实际修复时间和处置结果以弹窗提交值为准。
    // 已完成变已关闭：保留实际修复时间和处置结果，只更新关闭时间。
    let finalResolveDate
    if (old?.status === 3 && status !== 2 && status !== 3) {
      finalResolveDate = null
    } else if (old?.status === 2 && status !== 2 && status !== 3) {
      finalResolveDate = null
    } else if (status === 2 && resolve_date !== undefined) {
      finalResolveDate = resolve_date || null
    } else {
      finalResolveDate = old?.resolve_date || null
    }
    addChange('resolve_date', old?.resolve_date, finalResolveDate)

    let finalCloseDate
    if (old?.status === 3 && status !== 3) {
      finalCloseDate = null
    } else if (status === 3 && close_date !== undefined) {
      finalCloseDate = close_date || null
    } else {
      finalCloseDate = old?.close_date || null
    }
    addChange('close_date', old?.close_date, finalCloseDate)

    let finalResultDesc
    if (old?.status === 3 && status !== 2 && status !== 3) {
      finalResultDesc = null
    } else if (old?.status === 2 && status !== 2 && status !== 3) {
      finalResultDesc = null
    } else if (result_desc !== undefined) {
      finalResultDesc = result_desc || null
    } else {
      finalResultDesc = old?.result_desc || null
    }
    addChange('result_desc', old?.result_desc, finalResultDesc)

    await db.prepare(
      'UPDATE pms_work_order SET status = ?, is_overdue = ?, resolve_date = ?, close_date = ?, result_desc = ?, updater_id = ? WHERE id = ?'
    ).run(status, is_overdue, finalResolveDate, finalCloseDate, finalResultDesc, updater_id || null, req.params.id)

    if (updater_id) {
      for (const ch of changes) {
        await db.writeLog(updater_id, '状态变更', '运维工单', req.params.id, ch.field, ch.oldVal ?? '空', ch.newVal ?? '空', req.ip)
      }
    }
    res.json({ code: 0, message: 'success', data: null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '操作失败', data: null })
  }
}

exports.batchAssign = async (req, res) => {
  try {
    const { ids, follower_id, updater_id } = req.body
    const workOrderIds = Array.isArray(ids) ? ids.map((id) => Number(id)).filter(Boolean) : []
    const followerId = Number(follower_id)

    if (workOrderIds.length === 0) {
      return res.status(400).json({ code: 400, message: '请选择要指派的工单', data: null })
    }
    if (!followerId) {
      return res.status(400).json({ code: 400, message: '请选择跟进人', data: null })
    }

    const follower = await db.prepare('SELECT id, real_name FROM pms_user WHERE id = ? AND is_deleted = 0 AND status = 1').get(followerId)
    if (!follower) {
      return res.status(400).json({ code: 400, message: '跟进人不存在或已停用', data: null })
    }

    let updatedCount = 0
    await db.transaction(async (conn) => {
      const placeholders = workOrderIds.map(() => '?').join(',')
      const rows = await conn.prepare(
        `SELECT id, follower_id FROM pms_work_order WHERE id IN (${placeholders}) AND is_deleted = 0`
      ).all(...workOrderIds)

      if (rows.length !== workOrderIds.length) {
        throw new Error('部分工单不存在或已删除，请刷新后重试')
      }

      for (const row of rows) {
        if (Number(row.follower_id) === followerId) continue
        await conn.prepare('UPDATE pms_work_order SET follower_id = ?, updater_id = ?, updated_at = NOW() WHERE id = ?')
          .run(followerId, updater_id || null, row.id)
        if (updater_id) {
          await conn.prepare(
            'INSERT INTO pms_op_log (user_id, action, module, target_id, field_name, old_value, new_value, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(updater_id, '批量指派', '运维工单', row.id, 'follower_id', row.follower_id, followerId, req.ip)
        }
        updatedCount += 1
      }
    })

    res.json({ code: 0, message: 'success', data: { updated: updatedCount, requested: workOrderIds.length } })
  } catch (err) {
    console.error(err)
    res.status(400).json({ code: 400, message: err.message || '批量指派失败', data: null })
  }
}

exports.remove = async (req, res) => {
  try {
    const { updater_id } = req.body
    await db.prepare('UPDATE pms_work_order SET is_deleted = 1, updater_id = ? WHERE id = ?').run(updater_id || null, req.params.id)
    if (updater_id) await db.writeLog(updater_id, '删除', '运维工单', req.params.id, 'is_deleted', '0', '1', req.ip)
    res.json({ code: 0, message: 'success', data: null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '删除失败', data: null })
  }
}

/** 获取上一条、下一条工单的 ID（支持筛选条件和排序） */
exports.getNeighbors = async (req, res) => {
  try {
    const { id } = req.query
    if (!id) return res.status(400).json({ code: 400, message: '缺少 id 参数', data: null })

    const q = { ...req.query }
    const { sql: whereSql, params: whereParams } = buildWhereClause(q)

    const current = await db.prepare('SELECT created_at, id FROM pms_work_order WHERE id = ? AND is_deleted = 0').get(id)
    if (!current) return res.json({ code: 0, data: { prevId: null, nextId: null } })

    // Check if current record matches the filter
    const checkSql = 'SELECT id FROM pms_work_order w WHERE w.id = ?' + whereSql.replace(/^ WHERE/, ' AND')
    const checkParams = [id, ...whereParams]
    const inFilter = await db.prepare(checkSql).get(...checkParams)
    if (!inFilter) return res.json({ code: 0, data: { prevId: null, nextId: null } })

    // Map frontend sort field to DB column
    const sortMap = {
      problem_desc: 'w.problem_desc', system_id: 'sys.name', problem_type: 'pt.name', urgency: 'w.urgency', status: 'w.status',
      is_overdue: 'w.is_overdue', follower_name: 'w.follower_id', follower_id: 'w.follower_id',
      submitter_name: 'w.submitter_name', submitter_dept: 'w.submitter_dept',
      submit_time: 'w.submit_time', expected_resolve_date: 'w.expected_resolve_date',
      creator_name: null, created_at: 'w.created_at',
    }
    let sortCol = 'w.created_at'
    let sortDir = 'DESC'
    if (q.sort_field && sortMap[q.sort_field] !== undefined) {
      const mapped = sortMap[q.sort_field]
      if (mapped) {
        sortCol = mapped
        sortDir = q.sort_order === 'asc' ? 'ASC' : 'DESC'
      }
    }

    const orderClause = `ORDER BY ${sortCol} ${sortDir}, w.id ${sortDir}`

    const listSql = withJoins('w.id') + whereSql + ' ' + orderClause
    const allRows = await db.prepare(listSql).all(...whereParams)
    const idx = allRows.findIndex(r => r.id === Number(id))
    if (idx < 0) return res.json({ code: 0, data: { prevId: null, nextId: null } })

    const prevId = idx > 0 ? allRows[idx - 1].id : null
    const nextId = idx < allRows.length - 1 ? allRows[idx + 1].id : null

    res.json({ code: 0, message: 'success', data: { prevId, nextId } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}

/** Field name mapping: database field → Chinese label */
const FIELD_LABEL = {
  system_id: '所属系统', problem_type: '问题类型', problem_desc: '问题描述', result_desc: '处置结果', follower_id: '跟进人',
  urgency: '紧急程度', status: '状态', is_overdue: '逾期', expected_resolve_date: '预计完成时间',
  resolve_date: '实际修复时间', close_date: '关闭时间', submitter_name: '提出人', submitter_dept: '提出组织',
  submit_time: '提出时间',
}

/** Sort order for display (matches detail page field order) */
const FIELD_SORT_ORDER = [
  '问题描述', '所属系统', '问题类型', '紧急程度', '状态',
  '逾期', '跟进人', '提出人', '提出组织', '提出时间',
  '预计完成时间', '实际修复时间', '处置结果', '关闭时间',
]
const HISTORY_DATE_FIELDS = new Set(['expected_resolve_date', 'resolve_date', 'close_date', 'submit_time'])

function formatHistoryDate(value) {
  return String(value || '').replace('T', ' ').slice(0, 10)
}

/** Resolve a raw value to a display name based on field */
async function resolveValue(field, value) {
  if (value === '空' || value === undefined) return ''
  if (field === 'is_overdue') return value === null || value === '' ? '-' : (Number(value) === 1 ? '逾期' : '未逾期')
  if (value === null) return ''
  if (HISTORY_DATE_FIELDS.has(field)) return formatHistoryDate(value)
  if (field === 'follower_id') {
    const r = await db.prepare('SELECT real_name FROM pms_user WHERE id = ?').get(value)
    return r?.real_name || value
  }
  if (field === 'system_id' || field === 'problem_type') {
    const r = await db.prepare('SELECT name FROM pms_archive WHERE id = ?').get(value)
    return r?.name || value
  }
  if (field === 'urgency') {
    return { 0: '低', 1: '中', 2: '高' }[String(value)] || value
  }
  if (field === 'status') {
    return { 0: '待处理', 1: '处理中', 2: '已完成', 3: '已关闭' }[String(value)] || value
  }
  if (field === 'is_overdue') {
    return { 0: '否', 1: '是' }[String(value)] || value
  }
  return String(value)
}

function historyTimeKey(value) {
  return String(value || '').replace('T', ' ').slice(0, 19)
}

exports.getHistory = async (req, res) => {
  try {
    const orderId = req.params.id
    const logs = await db.prepare(
      `SELECT l.*, u.real_name FROM pms_op_log l
       LEFT JOIN pms_user u ON l.user_id = u.id
       WHERE l.module = '运维工单' AND l.target_id = ?
       ORDER BY l.created_at DESC`
    ).all(orderId)

    const grouped = []
    const groupMap = new Map()
    for (const log of logs) {
      const key = `${log.user_id}_${log.action}_${historyTimeKey(log.created_at)}`
      if (!groupMap.has(key)) {
        const group = { user: log.real_name, action: log.action, time: log.created_at, changes: [] }
        grouped.push(group)
        groupMap.set(key, group)
      }
      groupMap.get(key).changes.push(log)
    }

    const entries = []
    for (const g of grouped) {
      let title = ''
      const details = []

      if (g.action === '新增') {
        title = '创建'
      } else if (g.action === '删除') {
        title = '删除'
      } else if (g.action === '编辑') {
        title = '编辑'
        for (const ch of g.changes) {
          const label = FIELD_LABEL[ch.field_name] || ch.field_name
          const oldVal = await resolveValue(ch.field_name, ch.old_value)
          const newVal = await resolveValue(ch.field_name, ch.new_value)
          details.push({ field: label, oldVal, newVal })
        }
      } else if (g.action === '状态变更') {
        title = '状态变更'
        const statusChange = g.changes.find(c => c.field_name === 'status')
        if (statusChange) {
          const oldStatus = await resolveValue('status', statusChange.old_value)
          const newStatus = await resolveValue('status', statusChange.new_value)
          if (oldStatus && newStatus && oldStatus !== newStatus) {
            details.push({ field: '状态', oldVal: oldStatus, newVal: newStatus })
          }
        }
        for (const ch of g.changes) {
          if (ch.field_name === 'status') continue
          const label = FIELD_LABEL[ch.field_name] || ch.field_name
          const oldVal = await resolveValue(ch.field_name, ch.old_value)
          const newVal = await resolveValue(ch.field_name, ch.new_value)
          if (oldVal !== newVal) {
            details.push({ field: label, oldVal, newVal })
          }
        }
      }

      details.sort((a, b) => FIELD_SORT_ORDER.indexOf(a.field) - FIELD_SORT_ORDER.indexOf(b.field))

      if (!title || (g.action === '状态变更' && details.length === 0 && title === '状态变更')) continue

      entries.push({ time: g.time, user: g.user, title, details })
    }

    res.json({ code: 0, message: 'success', data: entries })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}
