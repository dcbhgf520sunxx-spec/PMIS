const db = require('../db')
const { parsePagination, getSortDirection } = require('../utils/pagination')
const { ok, fail } = require('../utils/response')
const { validateBody } = require('../utils/validation')
const { groupOperationLogs } = require('../utils/operationHistory')
const { formatHistoryChanges } = require('../utils/productProjectHistory')

const DETAIL_FIELD_ORDER = ['name', 'owner_id', 'description', 'status']
const HISTORY_FIELD_LABELS = { name: '产品名称', owner_id: '负责人', description: '产品描述', status: '状态', is_deleted: '删除状态' }

const schema = {
  name: { required: true, label: '产品名称' },
  owner_id: { required: true, type: 'number', label: '负责人' },
  status: { type: 'enum', values: [0, 1], label: '状态' },
}

function joins(fields) {
  return `SELECT ${fields}, creator.real_name creator_name, updater.real_name updater_name, owner.real_name owner_name
    FROM pms_product p
    LEFT JOIN pms_user creator ON creator.id = p.creator_id
    LEFT JOIN pms_user updater ON updater.id = p.updater_id
    LEFT JOIN pms_user owner ON owner.id = p.owner_id`
}

function where(q) {
  let sql = ' WHERE p.is_deleted = 0'
  const params = []
  if (q.name) { sql += ' AND p.name ILIKE ?'; params.push(`%${q.name}%`) }
  if (q.owner_ids) {
    const ids = String(q.owner_ids).split(',').map(Number).filter(Boolean)
    if (ids.length) { sql += ` AND p.owner_id IN (${ids.map(() => '?').join(',')})`; params.push(...ids) }
  }
  if (q.status !== undefined && q.status !== '') { sql += ' AND p.status = ?'; params.push(Number(q.status)) }
  return { sql, params }
}

exports.list = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query)
    const condition = where(req.query)
    const sortMap = { name: 'p.name', ownerName: 'owner.real_name', description: 'p.description', status: 'p.status', creatorName: 'creator.real_name', createdAt: 'p.created_at' }
    const sort = sortMap[req.query.sort_field] || 'p.created_at'
    const direction = getSortDirection(req.query.sort_order)
    const sql = joins('COUNT(*) OVER() total, p.id, p.name, p.description, p.owner_id, p.status, p.creator_id, p.updater_id, p.created_at, p.updated_at')
      + condition.sql + ` ORDER BY ${sort} ${direction}, p.id ${direction} LIMIT ? OFFSET ?`
    const rows = await db.prepare(sql).all(...condition.params, pageSize, offset)
    ok(res, { list: rows, total: Number(rows[0]?.total || 0), page, pageSize })
  } catch (error) { console.error(error); fail(res, 500, 500, '查询失败') }
}

exports.options = async (_req, res) => {
  try { ok(res, await db.prepare('SELECT id, name, status FROM pms_product WHERE is_deleted = 0 ORDER BY name').all()) }
  catch (error) { console.error(error); fail(res, 500, 500, '查询失败') }
}

exports.getById = async (req, res) => {
  try {
    const row = await db.prepare(joins('p.id, p.name, p.description, p.owner_id, p.status, p.creator_id, p.updater_id, p.created_at, p.updated_at') + ' WHERE p.id = ? AND p.is_deleted = 0').get(req.params.id)
    if (!row) return fail(res, 404, 404, '产品不存在')
    ok(res, row)
  } catch (error) { console.error(error); fail(res, 500, 500, '查询失败') }
}

async function validate(res, body, excludeId) {
  const result = validateBody(body, schema)
  if (!result.ok) { fail(res, 400, 400, result.message); return false }
  const duplicate = excludeId
    ? await db.prepare('SELECT id FROM pms_product WHERE name = ? AND is_deleted = 0 AND id <> ?').get(body.name.trim(), excludeId)
    : await db.prepare('SELECT id FROM pms_product WHERE name = ? AND is_deleted = 0').get(body.name.trim())
  if (duplicate) { fail(res, 400, 400, '产品名称已存在'); return false }
  const owner = await db.prepare('SELECT id FROM pms_user WHERE id = ? AND status = 1 AND is_deleted = 0').get(body.owner_id)
  if (!owner) { fail(res, 400, 400, '负责人不存在或已停用'); return false }
  return true
}

exports.create = async (req, res) => {
  try {
    if (!(await validate(res, req.body))) return
    const operatorId = req.user.id
    const result = await db.prepare('INSERT INTO pms_product (name, description, owner_id, status, creator_id, updater_id) VALUES (?, ?, ?, ?, ?, ?)').run(req.body.name.trim(), req.body.description || null, req.body.owner_id, 1, operatorId, operatorId)
    await db.writeLog(operatorId, '新增', '产品', result.lastInsertRowid, null, null, null, req.ip, req.body.name.trim())
    ok(res, { id: result.lastInsertRowid })
  } catch (error) { console.error(error); fail(res, 500, 500, '创建失败') }
}

exports.update = async (req, res) => {
  try {
    const old = await db.prepare('SELECT * FROM pms_product WHERE id = ? AND is_deleted = 0').get(req.params.id)
    if (!old) return fail(res, 404, 404, '产品不存在')
    if (!(await validate(res, req.body, Number(req.params.id)))) return
    const operatorId = req.user.id
    const status = req.body.status === undefined ? old.status : Number(req.body.status)
    await db.prepare('UPDATE pms_product SET name = ?, description = ?, owner_id = ?, status = ?, updater_id = ?, updated_at = NOW() WHERE id = ?').run(req.body.name.trim(), req.body.description || null, req.body.owner_id, status, operatorId, req.params.id)
    const changes = []
    for (const field of ['name', 'description', 'owner_id', 'status']) {
      const next = field === 'description' ? req.body.description || null : field === 'status' ? status : req.body[field]
      if (String(old[field] ?? '') !== String(next ?? '')) changes.push({ field, oldVal: old[field], newVal: next })
    }
    if (changes.length) await db.writeLogs(operatorId, '编辑', '产品', req.params.id, changes, req.ip, req.body.name.trim())
    ok(res, null)
  } catch (error) { console.error(error); fail(res, 500, 500, '更新失败') }
}

exports.toggleStatus = async (req, res) => {
  try {
    const status = Number(req.body.status)
    if (![0, 1].includes(status)) return fail(res, 400, 400, '状态不正确')
    const old = await db.prepare('SELECT name, status FROM pms_product WHERE id = ? AND is_deleted = 0').get(req.params.id)
    if (!old) return fail(res, 404, 404, '产品不存在')
    await db.prepare('UPDATE pms_product SET status = ?, updater_id = ?, updated_at = NOW() WHERE id = ?').run(status, req.user.id, req.params.id)
    await db.writeLog(req.user.id, '状态变更', '产品', req.params.id, 'status', old.status, status, req.ip, old.name)
    ok(res, null)
  } catch (error) { console.error(error); fail(res, 500, 500, '操作失败') }
}

exports.remove = async (req, res) => {
  try {
    const product = await db.prepare('SELECT name FROM pms_product WHERE id = ? AND is_deleted = 0').get(req.params.id)
    if (!product) return fail(res, 404, 404, '产品不存在')
    const reference = await db.prepare('SELECT COUNT(*) count FROM pms_project WHERE product_id = ? AND is_deleted = 0').get(req.params.id)
    if (Number(reference.count)) return fail(res, 400, 400, '该产品已被项目引用，无法删除')
    await db.prepare('UPDATE pms_product SET is_deleted = 1, updater_id = ?, updated_at = NOW() WHERE id = ?').run(req.user.id, req.params.id)
    await db.writeLog(req.user.id, '删除', '产品', req.params.id, 'is_deleted', 0, 1, req.ip, product.name)
    ok(res, null)
  } catch (error) { console.error(error); fail(res, 500, 500, '删除失败') }
}

exports.history = async (req, res) => {
  try {
    const logs = await db.prepare("SELECT l.id, l.operation_id, l.action, l.field_name, l.old_value, l.new_value, l.created_at, COALESCE(u.real_name, '-') operator FROM pms_op_log l LEFT JOIN pms_user u ON u.id = l.user_id WHERE l.module = '产品' AND l.target_id = ? ORDER BY l.created_at DESC").all(req.params.id)
    const ownerIds = [...new Set(logs.filter((log) => log.field_name === 'owner_id').flatMap((log) => [log.old_value, log.new_value]).map(Number).filter(Number.isFinite))]
    const owners = ownerIds.length ? await db.prepare(`SELECT id, real_name FROM pms_user WHERE id IN (${ownerIds.map(() => '?').join(',')})`).all(...ownerIds) : []
    const valueLookups = {
      owner_id: new Map(owners.map((owner) => [String(owner.id), owner.real_name])),
      status: new Map([['0', '停用'], ['1', '启用']]),
      is_deleted: new Map([['0', '正常'], ['1', '已删除']]),
    }
    ok(res, groupOperationLogs(logs, DETAIL_FIELD_ORDER).map((group) => ({ id: group.id, action: group.action, created_at: group.created_at, operator: group.operator, changes: formatHistoryChanges(group.changes, { fieldLabels: HISTORY_FIELD_LABELS, valueLookups }) })))
  }
  catch (error) { console.error(error); fail(res, 500, 500, '查询失败') }
}
