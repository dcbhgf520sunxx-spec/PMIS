const db = require('../db')
const { parsePagination, getSortDirection } = require('../utils/pagination')
const { ok, fail } = require('../utils/response')
const { validateBody } = require('../utils/validation')
const { normalizeMemberIds, validateProjectStatusChange, calculateProjectOverdue, allowedProjectStatuses } = require('../services/productProjectRules')
const { groupOperationLogs } = require('../utils/operationHistory')

const DETAIL_FIELD_ORDER = ['name', 'product_id', 'owner_id', 'description', 'start_date', 'expected_end_date', 'progress_text', 'risk_text', 'status', 'is_overdue', 'actual_end_date', 'suspend_date']

const schema = {
  name: { required: true, label: '项目名称' },
  product_id: { required: true, type: 'number', label: '所属产品' },
  owner_id: { required: true, type: 'number', label: '负责人' },
  expected_end_date: { required: true, label: '预计完成日期' },
}

const fields = `p.id, p.name, p.description, p.product_id, product.name product_name,
  p.owner_id, owner.real_name owner_name, p.status, p.is_overdue, p.start_date,
  p.expected_end_date, p.actual_end_date, p.suspend_date, p.progress_text, p.risk_text,
  p.creator_id, creator.real_name creator_name, p.updater_id, updater.real_name updater_name,
  p.created_at, p.updated_at,
  CASE WHEN p.status = 3 THEN (SELECT old_value::INTEGER FROM pms_op_log l WHERE l.module = '项目' AND l.target_id = p.id AND l.action = '状态变更' AND l.field_name = 'status' AND l.new_value = '3' ORDER BY l.created_at DESC LIMIT 1) END previous_status,
  COALESCE((SELECT json_agg(json_build_object('id', u.id, 'name', u.real_name) ORDER BY u.real_name)
    FROM pms_project_member pm JOIN pms_user u ON u.id = pm.user_id WHERE pm.project_id = p.id), '[]'::json) members`

function baseSelect(extra = fields) {
  return `SELECT ${extra} FROM pms_project p
    JOIN pms_product product ON product.id = p.product_id
    JOIN pms_user owner ON owner.id = p.owner_id
    LEFT JOIN pms_user creator ON creator.id = p.creator_id
    LEFT JOIN pms_user updater ON updater.id = p.updater_id`
}

function where(q) {
  let sql = ' WHERE p.is_deleted = 0'
  const params = []
  if (q.name) { sql += ' AND p.name ILIKE ?'; params.push(`%${q.name}%`) }
  if (q.product_id) { sql += ' AND p.product_id = ?'; params.push(Number(q.product_id)) }
  if (q.owner_id) { sql += ' AND p.owner_id = ?'; params.push(Number(q.owner_id)) }
  if (q.member_ids) {
    const ids = String(q.member_ids).split(',').map(Number).filter(Boolean)
    for (const id of ids) { sql += ' AND EXISTS (SELECT 1 FROM pms_project_member pm WHERE pm.project_id = p.id AND pm.user_id = ?)'; params.push(id) }
  }
  if (q.joined_user_id) { sql += ' AND EXISTS (SELECT 1 FROM pms_project_member pm WHERE pm.project_id = p.id AND pm.user_id = ?)'; params.push(Number(q.joined_user_id)) }
  if (q.status !== undefined && q.status !== '') { sql += ' AND p.status = ?'; params.push(Number(q.status)) }
  if (q.is_overdue !== undefined && q.is_overdue !== '') { sql += ' AND p.is_overdue = ?'; params.push(Number(q.is_overdue)) }
  if (q.expected_end_date_from) { sql += ' AND p.expected_end_date >= ?'; params.push(q.expected_end_date_from) }
  if (q.expected_end_date_to) { sql += ' AND p.expected_end_date <= ?'; params.push(q.expected_end_date_to) }
  return { sql, params }
}

async function getProjectViewCount(q) {
  const condition = where(q)
  const row = await db.prepare(`SELECT COUNT(*) total FROM pms_project p${condition.sql}`).get(...condition.params)
  return Number(row?.total || 0)
}

exports.list = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query)
    const condition = where(req.query)
    const sortMap = { name: 'p.name', productName: 'product.name', ownerName: 'owner.real_name', status: 'p.status', isOverdue: 'p.is_overdue', expectedEndDate: 'p.expected_end_date', members: "COALESCE((SELECT STRING_AGG(u.real_name, '、' ORDER BY u.real_name) FROM pms_project_member pm JOIN pms_user u ON u.id = pm.user_id WHERE pm.project_id = p.id), '')", creatorName: 'creator.real_name', createdAt: 'p.created_at' }
    const sort = sortMap[req.query.sort_field] || 'p.created_at'
    const direction = getSortDirection(req.query.sort_order)
    const rows = await db.prepare(baseSelect(`COUNT(*) OVER() total, ${fields}`) + condition.sql + ` ORDER BY ${sort} ${direction}, p.id ${direction} LIMIT ? OFFSET ?`).all(...condition.params, pageSize, offset)
    const currentUserId = Number(req.query.current_user_id)
    const viewCounts = currentUserId ? {
      all: await getProjectViewCount({ ...req.query, owner_id: req.query.filter_owner_id, joined_user_id: undefined }),
      mine: await getProjectViewCount({ ...req.query, owner_id: currentUserId, joined_user_id: undefined }),
      joined: await getProjectViewCount({ ...req.query, owner_id: req.query.filter_owner_id, joined_user_id: currentUserId })
    } : { all: 0, mine: 0, joined: 0 }
    ok(res, { list: rows, total: Number(rows[0]?.total || 0), page, pageSize, viewCounts })
  } catch (error) { console.error(error); fail(res, 500, 500, '查询失败') }
}

exports.getById = async (req, res) => {
  try {
    const row = await db.prepare(baseSelect() + ' WHERE p.id = ? AND p.is_deleted = 0').get(req.params.id)
    if (!row) return fail(res, 404, 404, '项目不存在')
    ok(res, row)
  } catch (error) { console.error(error); fail(res, 500, 500, '查询失败') }
}

async function validate(res, body, excludeId) {
  const result = validateBody(body, schema)
  if (!result.ok) { fail(res, 400, 400, result.message); return false }
  const duplicate = excludeId
    ? await db.prepare('SELECT id FROM pms_project WHERE name = ? AND is_deleted = 0 AND id <> ?').get(body.name.trim(), excludeId)
    : await db.prepare('SELECT id FROM pms_project WHERE name = ? AND is_deleted = 0').get(body.name.trim())
  if (duplicate) { fail(res, 400, 400, '项目名称已存在'); return false }
  const product = await db.prepare('SELECT id FROM pms_product WHERE id = ? AND status = 1 AND is_deleted = 0').get(body.product_id)
  if (!product) { fail(res, 400, 400, '所属产品不存在或已停用'); return false }
  const owner = await db.prepare('SELECT id FROM pms_user WHERE id = ? AND status = 1 AND is_deleted = 0').get(body.owner_id)
  if (!owner) { fail(res, 400, 400, '负责人不存在或已停用'); return false }
  const memberIds = normalizeMemberIds(body.member_ids)
  if (memberIds.length) {
    const users = await db.prepare(`SELECT id FROM pms_user WHERE id IN (${memberIds.map(() => '?').join(',')}) AND status = 1 AND is_deleted = 0`).all(...memberIds)
    if (users.length !== memberIds.length) { fail(res, 400, 400, '项目成员中存在无效或停用用户'); return false }
  }
  return true
}

async function replaceMembers(tx, projectId, memberIds) {
  await tx.prepare('DELETE FROM pms_project_member WHERE project_id = ?').run(projectId)
  for (const userId of normalizeMemberIds(memberIds)) await tx.prepare('INSERT INTO pms_project_member (project_id, user_id) VALUES (?, ?)').run(projectId, userId)
}

exports.create = async (req, res) => {
  try {
    if (!(await validate(res, req.body))) return
    const operatorId = req.user.id
    const id = await db.transaction(async (tx) => {
      const result = await tx.prepare(`INSERT INTO pms_project
        (name, description, product_id, owner_id, status, is_overdue, start_date, expected_end_date, progress_text, risk_text, creator_id, updater_id)
        VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`)
        .run(req.body.name.trim(), req.body.description || null, req.body.product_id, req.body.owner_id, calculateProjectOverdue(req.body.expected_end_date, 0), req.body.start_date || null, req.body.expected_end_date, req.body.progress_text || null, req.body.risk_text || null, operatorId, operatorId)
      await replaceMembers(tx, result.lastInsertRowid, req.body.member_ids)
      return result.lastInsertRowid
    })
    await db.writeLog(operatorId, '新增', '项目', id, null, null, null, req.ip, req.body.name.trim())
    ok(res, { id })
  } catch (error) { console.error(error); fail(res, 500, 500, '创建失败') }
}

exports.update = async (req, res) => {
  try {
    const old = await db.prepare('SELECT * FROM pms_project WHERE id = ? AND is_deleted = 0').get(req.params.id)
    if (!old) return fail(res, 404, 404, '项目不存在')
    if (!(await validate(res, req.body, Number(req.params.id)))) return
    const operatorId = req.user.id
    const status = Number(old.status)
    const overdue = calculateProjectOverdue(req.body.expected_end_date, status)
    await db.transaction(async (tx) => {
      await tx.prepare(`UPDATE pms_project SET name = ?, description = ?, product_id = ?, owner_id = ?, is_overdue = ?, start_date = ?, expected_end_date = ?, progress_text = ?, risk_text = ?, updater_id = ?, updated_at = NOW() WHERE id = ?`)
        .run(req.body.name.trim(), req.body.description || null, req.body.product_id, req.body.owner_id, overdue, req.body.start_date || null, req.body.expected_end_date, req.body.progress_text || null, req.body.risk_text || null, operatorId, req.params.id)
      await replaceMembers(tx, req.params.id, req.body.member_ids)
    })
    const changes = []
    for (const field of ['name', 'description', 'product_id', 'owner_id', 'start_date', 'expected_end_date', 'progress_text', 'risk_text', 'is_overdue']) {
      const next = field === 'is_overdue' ? overdue : req.body[field] || null
      if (String(old[field] ?? '') !== String(next ?? '')) changes.push({ field, oldVal: old[field], newVal: next })
    }
    if (changes.length) await db.writeLogs(operatorId, '编辑', '项目', req.params.id, changes, req.ip, req.body.name.trim())
    ok(res, null)
  } catch (error) { console.error(error); fail(res, 500, 500, '更新失败') }
}

exports.toggleStatus = async (req, res) => {
  try {
    const status = Number(req.body.status)
    if (![0, 1, 2, 3].includes(status)) return fail(res, 400, 400, '状态不正确')
    const validation = validateProjectStatusChange(status, req.body)
    if (validation) return fail(res, 400, 400, validation)
    const old = await db.prepare('SELECT name, status, expected_end_date, actual_end_date, suspend_date FROM pms_project WHERE id = ? AND is_deleted = 0').get(req.params.id)
    if (!old) return fail(res, 404, 404, '项目不存在')
    let previousStatus
    if (Number(old.status) === 3) {
      const previous = await db.prepare("SELECT old_value FROM pms_op_log WHERE module = '项目' AND target_id = ? AND action = '状态变更' AND field_name = 'status' AND new_value = '3' ORDER BY created_at DESC LIMIT 1").get(req.params.id)
      previousStatus = previous?.old_value === undefined ? undefined : Number(previous.old_value)
    }
    if (!allowedProjectStatuses(old.status, previousStatus).includes(status)) return fail(res, 400, 400, '不允许执行该状态流转')
    const actualEndDate = status === 2 ? req.body.actual_end_date : null
    const suspendDate = status === 3 ? req.body.suspend_date : null
    const overdue = calculateProjectOverdue(old.expected_end_date, status)
    await db.prepare('UPDATE pms_project SET status = ?, is_overdue = ?, actual_end_date = ?, suspend_date = ?, updater_id = ?, updated_at = NOW() WHERE id = ?').run(status, overdue, actualEndDate, suspendDate, req.user.id, req.params.id)
    const changes = [{ field: 'status', oldVal: old.status, newVal: status }]
    if (String(old.actual_end_date || '') !== String(actualEndDate || '')) changes.push({ field: 'actual_end_date', oldVal: old.actual_end_date, newVal: actualEndDate })
    if (String(old.suspend_date || '') !== String(suspendDate || '')) changes.push({ field: 'suspend_date', oldVal: old.suspend_date, newVal: suspendDate })
    await db.writeLogs(req.user.id, '状态变更', '项目', req.params.id, changes, req.ip, old.name)
    ok(res, null)
  } catch (error) { console.error(error); fail(res, 500, 500, '操作失败') }
}

exports.remove = async (req, res) => {
  try {
    const project = await db.prepare('SELECT name FROM pms_project WHERE id = ? AND is_deleted = 0').get(req.params.id)
    if (!project) return fail(res, 404, 404, '项目不存在')
    await db.prepare('UPDATE pms_project SET is_deleted = 1, updater_id = ?, updated_at = NOW() WHERE id = ?').run(req.user.id, req.params.id)
    await db.writeLog(req.user.id, '删除', '项目', req.params.id, 'is_deleted', 0, 1, req.ip, project.name)
    ok(res, null)
  } catch (error) { console.error(error); fail(res, 500, 500, '删除失败') }
}

exports.history = async (req, res) => {
  try {
    const logs = await db.prepare("SELECT l.id, l.operation_id, l.action, l.field_name, l.old_value, l.new_value, l.created_at, COALESCE(u.real_name, '-') operator FROM pms_op_log l LEFT JOIN pms_user u ON u.id = l.user_id WHERE l.module = '项目' AND l.target_id = ? ORDER BY l.created_at DESC").all(req.params.id)
    ok(res, groupOperationLogs(logs, DETAIL_FIELD_ORDER).map((group) => ({ id: group.id, action: group.action, created_at: group.created_at, operator: group.operator, changes: group.changes.map(({ field_name, old_value, new_value }) => ({ field_name, old_value, new_value })) })))
  }
  catch (error) { console.error(error); fail(res, 500, 500, '查询失败') }
}
