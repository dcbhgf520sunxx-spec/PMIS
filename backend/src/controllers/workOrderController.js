const db = require('../db')
const { calcOverdue } = require('../utils/calcOverdue')
const { refreshOverdueStatus } = require('../services/overdueCron')
const { getSortDirection, parsePagination } = require('../utils/pagination')
const { fail, failField, ok } = require('../utils/response')
const { validateBody } = require('../utils/validation')
const { buildViewQuery, calculateViewCounts } = require('../utils/viewCounts')
const { groupOperationLogs } = require('../utils/operationHistory')

function requireValidBody(res, body, schema) {
  const result = validateBody(body, schema)
  if (result.ok) return true
  fail(res, 400, 400, result.message)
  return false
}

const workOrderFormSchema = {
  problem_type: { required: true, type: 'number', label: '问题类型' },
  system_id: { required: true, type: 'number', label: '所属系统' },
  problem_desc: { required: true, label: '问题描述' },
  follower_id: { required: true, type: 'number', label: '跟进人' },
  urgency: { required: true, type: 'enum', values: [0, 1, 2], label: '紧急程度' },
  status: { type: 'enum', values: [0, 1, 2, 3], label: '状态' },
  expected_resolve_date: { required: true, label: '预计完成时间' },
  submitter_name: { required: true, label: '提出人' },
  submitter_dept: { required: true, label: '提出组织' },
  submit_time: { required: true, label: '提出时间' }
}

const workOrderStatusSchema = {
  status: { required: true, type: 'enum', values: [0, 1, 2, 3], label: '状态' }
}

const workOrderBatchAssignSchema = {
  ids: { required: true, type: 'array', label: '工单' },
  follower_id: { required: true, type: 'number', label: '跟进人' }
}

function isProblemDescriptionUniqueViolation(error) {
  return error?.code === '23505' && error?.constraint === 'uk_work_order_problem_desc_active'
}

const WORK_ORDER_SORT_MAP = {
  problem_desc: 'w.problem_desc', system_id: 'sys.name', problem_type: 'pt.name', urgency: 'w.urgency', status: 'w.status',
  is_overdue: 'w.is_overdue', follower_name: 'w.follower_id', follower_id: 'w.follower_id',
  submitter_name: 'w.submitter_name', submitter_dept: 'w.submitter_dept', submit_time: 'w.submit_time',
  expected_resolve_date: 'w.expected_resolve_date', creator_name: 'u1.real_name', created_at: 'w.created_at'
}

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
  if (q.problem_type !== undefined && q.problem_type !== '') {
    const problemTypes = String(q.problem_type).split(',').map(Number).filter(Number.isFinite)
    if (problemTypes.length > 1) {
      sql += ` AND w.problem_type IN (${problemTypes.map(() => '?').join(',')})`
      params.push(...problemTypes)
    } else if (problemTypes.length === 1) {
      sql += ' AND w.problem_type = ?'
      params.push(problemTypes[0])
    }
  }
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

function buildWorkOrderCountSql(q) {
  const { sql, params } = buildWhereClause(q)
  return {
    sql: `SELECT COUNT(*) as total FROM pms_work_order w${sql}`,
    params
  }
}

function buildWorkOrderViewContext(q) {
  const filters = { ...q, follower_id: q.filter_follower_id }
  delete filters.filter_follower_id
  delete filters.view_key
  delete filters.current_user_id

  const views = {
    all: {},
    mine: {
      omitFilters: ['follower_id'],
      scope: { follower_id: q.current_user_id }
    }
  }
  const viewKey = q.view_key === 'mine' ? 'mine' : 'all'
  return { filters, views, viewKey }
}

exports.list = async (req, res) => {
  try {
    const q = { ...req.query }
    const { page, pageSize, offset } = parsePagination(q)
    let sql = withJoins('COUNT(*) OVER() as total, w.id, w.system_id, w.problem_type, w.problem_desc, w.result_desc, w.follower_id, w.urgency, w.status, w.is_overdue, w.expected_resolve_date, w.resolve_date, w.close_date, w.submitter_name, w.submitter_dept, w.submit_time, w.created_at')
    const { filters, views, viewKey } = buildWorkOrderViewContext(q)
    const { sql: whereSql, params } = buildWhereClause(buildViewQuery(filters, views[viewKey]))
    sql += whereSql

    // 支持排序参数（与 neighbors 逻辑一致）
    let sortCol = 'w.created_at'
    let sortDir = 'DESC'
    if (q.sort_field && WORK_ORDER_SORT_MAP[q.sort_field] !== undefined) {
      const mapped = WORK_ORDER_SORT_MAP[q.sort_field]
      if (mapped) {
        sortCol = mapped
        sortDir = getSortDirection(q.sort_order)
      }
    }
    sql += ` ORDER BY ${sortCol} ${sortDir}, w.id ${sortDir} LIMIT ? OFFSET ?`
    params.push(pageSize, offset)

    const rows = await db.prepare(sql).all(...params)
    const currentTotal = Number(rows[0]?.total || 0)
    const viewCounts = q.current_user_id ? await calculateViewCounts({
      filters,
      views,
      count: async (query) => {
        const countQuery = buildWorkOrderCountSql(query)
        const row = await db.prepare(countQuery.sql).get(...countQuery.params)
        return row?.total
      }
    }) : undefined
    res.json({ code: 0, message: 'success', data: { list: rows, total: currentTotal, page, pageSize, viewCounts } })
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
    if (!requireValidBody(res, req.body, workOrderFormSchema)) return
    const { system_id, problem_type, problem_desc, follower_id, urgency, status, expected_resolve_date, submitter_name, submitter_dept, submit_time } = req.body
    const operatorId = req.user.id

    // Validate problem_desc uniqueness
    if (problem_desc) {
      const exists = await db.prepare('SELECT id FROM pms_work_order WHERE problem_desc = ? AND is_deleted = 0').get(problem_desc)
      if (exists) return failField(res, 'problem_desc', '问题描述已存在，请勿重复创建')
    }

    const finalStatus = status !== undefined ? status : 0
    const is_overdue = calcOverdue(expected_resolve_date, finalStatus)

    const result = await db.prepare(
      'INSERT INTO pms_work_order (system_id, problem_type, problem_desc, follower_id, urgency, status, is_overdue, expected_resolve_date, submitter_name, submitter_dept, submit_time, creator_id, updater_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(system_id || null, problem_type || null, problem_desc || null, follower_id || null, urgency ?? 1, finalStatus, is_overdue, expected_resolve_date || null, submitter_name || null, submitter_dept || null, submit_time || null, operatorId, operatorId)

    await db.writeLog(operatorId, '新增', '运维工单', result.lastInsertRowid, null, null, JSON.stringify({ system_id, problem_type, follower_id, urgency }), req.ip)
    ok(res, { id: result.lastInsertRowid })
  } catch (err) {
    if (isProblemDescriptionUniqueViolation(err)) {
      return failField(res, 'problem_desc', '问题描述已存在，请勿重复创建')
    }
    console.error(err)
    fail(res, 500, 500, '创建失败')
  }
}

exports.update = async (req, res) => {
  try {
    if (!requireValidBody(res, req.body, workOrderFormSchema)) return
    const { system_id, problem_type, problem_desc, result_desc, follower_id, urgency, status, expected_resolve_date, resolve_date, close_date, submitter_name, submitter_dept, submit_time } = req.body
    const operatorId = req.user.id

    if (problem_desc) {
      const exists = await db.prepare('SELECT id FROM pms_work_order WHERE problem_desc = ? AND is_deleted = 0 AND id <> ?').get(problem_desc, req.params.id)
      if (exists) return failField(res, 'problem_desc', '问题描述已存在，请勿重复创建')
    }

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
    params.push(operatorId)
    params.push(req.params.id)

    const sql = `UPDATE pms_work_order SET ${setParts.join(', ')} WHERE id = ?`
    await db.prepare(sql).run(...params)

    if (changes.length > 0) await db.writeLogs(operatorId, '编辑', '运维工单', req.params.id, changes, req.ip)

    ok(res, null)
  } catch (err) {
    if (isProblemDescriptionUniqueViolation(err)) {
      return failField(res, 'problem_desc', '问题描述已存在，请勿重复创建')
    }
    console.error(err)
    fail(res, 500, 500, '更新失败')
  }
}

exports.toggleStatus = async (req, res) => {
  try {
    if (!requireValidBody(res, req.body, workOrderStatusSchema)) return
    const { status, resolve_date, close_date, result_desc } = req.body
    const operatorId = req.user.id
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
    ).run(status, is_overdue, finalResolveDate, finalCloseDate, finalResultDesc, operatorId, req.params.id)

    await db.writeLogs(operatorId, '状态变更', '运维工单', req.params.id, changes.map((change) => ({
      ...change,
      oldVal: change.oldVal ?? '空',
      newVal: change.newVal ?? '空'
    })), req.ip)
    ok(res, null)
  } catch (err) {
    console.error(err)
    fail(res, 500, 500, '操作失败')
  }
}

exports.batchAssign = async (req, res) => {
  try {
    if (!requireValidBody(res, req.body, workOrderBatchAssignSchema)) return
    const { ids, follower_id } = req.body
    const operatorId = req.user.id
    const workOrderIds = Array.isArray(ids) ? ids.map((id) => Number(id)).filter(Boolean) : []
    const followerId = Number(follower_id)

    if (workOrderIds.length === 0) {
      return fail(res, 400, 400, '请选择要指派的工单')
    }
    if (!followerId) {
      return fail(res, 400, 400, '请选择跟进人')
    }

    const follower = await db.prepare('SELECT id, real_name FROM pms_user WHERE id = ? AND is_deleted = 0 AND status = 1').get(followerId)
    if (!follower) {
      return fail(res, 400, 400, '跟进人不存在或已停用')
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
          .run(followerId, operatorId, row.id)
        await conn.prepare(
          'INSERT INTO pms_op_log (user_id, action, module, target_id, field_name, old_value, new_value, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(operatorId, '批量指派', '运维工单', row.id, 'follower_id', row.follower_id, followerId, req.ip)
        updatedCount += 1
      }
    })

    ok(res, { updated: updatedCount, requested: workOrderIds.length })
  } catch (err) {
    console.error(err)
    fail(res, 400, 400, err.message || '批量指派失败')
  }
}

exports.remove = async (req, res) => {
  try {
    const operatorId = req.user.id
    await db.prepare('UPDATE pms_work_order SET is_deleted = 1, updater_id = ? WHERE id = ?').run(operatorId, req.params.id)
    await db.writeLog(operatorId, '删除', '运维工单', req.params.id, 'is_deleted', '0', '1', req.ip)
    ok(res, null)
  } catch (err) {
    console.error(err)
    fail(res, 500, 500, '删除失败')
  }
}

/** 获取上一条、下一条工单的 ID（支持筛选条件和排序） */
exports.getNeighbors = async (req, res) => {
  try {
    const { id } = req.query
    if (!id) return res.status(400).json({ code: 400, message: '缺少 id 参数', data: null })

    const q = { ...req.query }
    const { filters, views, viewKey } = buildWorkOrderViewContext(q)
    const { sql: whereSql, params: whereParams } = buildWhereClause(buildViewQuery(filters, views[viewKey]))

    const current = await db.prepare('SELECT created_at, id FROM pms_work_order WHERE id = ? AND is_deleted = 0').get(id)
    if (!current) return res.json({ code: 0, data: { prevId: null, nextId: null } })

    // Check if current record matches the filter
    const checkSql = 'SELECT id FROM pms_work_order w WHERE w.id = ?' + whereSql.replace(/^ WHERE/, ' AND')
    const checkParams = [id, ...whereParams]
    const inFilter = await db.prepare(checkSql).get(...checkParams)
    if (!inFilter) return res.json({ code: 0, data: { prevId: null, nextId: null } })

    // Map frontend sort field to DB column
    let sortCol = 'w.created_at'
    let sortDir = 'DESC'
    if (q.sort_field && WORK_ORDER_SORT_MAP[q.sort_field] !== undefined) {
      const mapped = WORK_ORDER_SORT_MAP[q.sort_field]
      if (mapped) {
        sortCol = mapped
        sortDir = q.sort_order === 'asc' ? 'ASC' : 'DESC'
      }
    }

    const orderClause = `ORDER BY ${sortCol} ${sortDir}, w.id ${sortDir}`

    const listSql = withJoins('w.id') + whereSql + ' ' + orderClause
    const allRows = await db.prepare(listSql).all(...whereParams)
    const idx = allRows.findIndex(r => String(r.id) === String(id))
    if (idx < 0) return res.json({ code: 0, data: { prevId: null, nextId: null } })

    const prevId = idx > 0 ? allRows[idx - 1].id : null
    const nextId = idx < allRows.length - 1 ? allRows[idx + 1].id : null

    res.json({ code: 0, message: 'success', data: { prevId, nextId, total: allRows.length, ordinal: idx + 1 } })
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
const DETAIL_FIELD_ORDER = [
  'problem_desc', 'system_id', 'problem_type', 'urgency', 'status',
  'is_overdue', 'follower_id', 'submitter_name', 'submitter_dept', 'submit_time',
  'expected_resolve_date', 'resolve_date', 'result_desc', 'close_date',
]
const HISTORY_DATE_FIELDS = new Set(['expected_resolve_date', 'resolve_date', 'close_date', 'submit_time'])

function formatHistoryDate(value) {
  return String(value || '').replace('T', ' ').slice(0, 10)
}

/** Resolve a raw value to a display name based on field */
function resolveValue(field, value, lookups = {}) {
  if (value === '空' || value === undefined) return ''
  if (field === 'is_overdue') return value === null || value === '' ? '-' : (Number(value) === 1 ? '逾期' : '未逾期')
  if (value === null) return ''
  if (HISTORY_DATE_FIELDS.has(field)) return formatHistoryDate(value)
  if (field === 'follower_id') {
    return lookups.users?.get(String(value)) || value
  }
  if (field === 'system_id' || field === 'problem_type') {
    return lookups.archives?.get(String(value)) || value
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

function buildIdInQuery(ids, selectSql, tableName) {
  const values = [...ids].filter(Number.isFinite)
  if (!values.length) return { rows: [], promise: Promise.resolve([]) }
  const placeholders = values.map(() => '?').join(',')
  return {
    promise: db.prepare(`${selectSql} FROM ${tableName} WHERE id IN (${placeholders})`).all(...values)
  }
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
    const followerIds = new Set()
    const archiveIds = new Set()
    for (const log of logs) {
      if (log.field_name === 'follower_id') [log.old_value, log.new_value].forEach(value => value && value !== '空' && followerIds.add(Number(value)))
      if (log.field_name === 'system_id' || log.field_name === 'problem_type') [log.old_value, log.new_value].forEach(value => value && value !== '空' && archiveIds.add(Number(value)))
    }
    const userLookupQuery = buildIdInQuery(followerIds, 'SELECT id, real_name', 'pms_user')
    const archiveLookupQuery = buildIdInQuery(archiveIds, 'SELECT id, name', 'pms_archive')
    const [users, archives] = await Promise.all([
      userLookupQuery.promise,
      archiveLookupQuery.promise
    ])
    const lookups = {
      users: new Map(users.map(row => [String(row.id), row.real_name])),
      archives: new Map(archives.map(row => [String(row.id), row.name]))
    }

    const grouped = groupOperationLogs(logs, DETAIL_FIELD_ORDER).map((group) => ({
      user: group.real_name,
      action: group.action,
      time: group.created_at,
      changes: group.changes
    }))

    const entries = []
    for (const g of grouped) {
      let title = ''
      const details = []

      if (g.action === '新增') {
        title = '创建'
      } else if (g.action === '删除') {
        title = '删除'
      } else if (g.action === '编辑' || g.action === '批量指派') {
        title = g.action
        for (const ch of g.changes) {
          const label = FIELD_LABEL[ch.field_name] || ch.field_name
          const oldVal = resolveValue(ch.field_name, ch.old_value, lookups)
          const newVal = resolveValue(ch.field_name, ch.new_value, lookups)
          details.push({ field: label, oldVal, newVal })
        }
      } else if (g.action === '状态变更') {
        title = '状态变更'
        const statusChange = g.changes.find(c => c.field_name === 'status')
        if (statusChange) {
          const oldStatus = resolveValue('status', statusChange.old_value, lookups)
          const newStatus = resolveValue('status', statusChange.new_value, lookups)
          if (oldStatus && newStatus && oldStatus !== newStatus) {
            details.push({ field: '状态', oldVal: oldStatus, newVal: newStatus })
          }
        }
        for (const ch of g.changes) {
          if (ch.field_name === 'status') continue
          const label = FIELD_LABEL[ch.field_name] || ch.field_name
          const oldVal = resolveValue(ch.field_name, ch.old_value, lookups)
          const newVal = resolveValue(ch.field_name, ch.new_value, lookups)
          if (oldVal !== newVal) {
            details.push({ field: label, oldVal, newVal })
          }
        }
      }

      if (!title || (g.action === '状态变更' && details.length === 0 && title === '状态变更')) continue

      entries.push({ time: g.time, user: g.user, title, details })
    }

    res.json({ code: 0, message: 'success', data: entries })
  } catch (err) {
    console.error(err)
    res.status(500).json({ code: 500, message: '查询失败', data: null })
  }
}
