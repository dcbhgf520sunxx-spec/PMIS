const db = require('../db')
const { parsePagination, getSortDirection } = require('../utils/pagination')
const { ok, fail, failField } = require('../utils/response')
const { formatHistoryChanges, groupOperationLogs } = require('../utils/operationHistory')
const { allowedBugStatuses, validateBugStatusChange, resolveBugStatusFields } = require('../services/bugRules')

const DETAIL_FIELD_ORDER = ['title', 'description', 'source_type', 'project_id', 'requirement_id', 'bug_type_id', 'severity', 'status', 'activation_reason', 'assignee_id', 'resolved_date', 'resolution_id', 'closed_date']
const HISTORY_FIELD_LABELS = {
  title: 'Bug标题', description: 'Bug描述', source_type: '关联类型', project_id: '关联项目', requirement_id: '关联需求',
  bug_type_id: 'Bug类型', severity: '严重程度', status: 'Bug状态', activation_reason: '激活原因', assignee_id: '指派给',
  resolved_date: '修复时间', closed_date: '关闭时间', resolution_id: '解决方案'
}
const HISTORY_DATE_FIELDS = new Set(['resolved_date', 'closed_date'])
const fields = `b.*,assignee.real_name assignee_name,creator.real_name creator_name,updater.real_name updater_name,project.name project_name,requirement.title requirement_name,bug_type.name bug_type_name,resolution.name resolution_name`

function base(extra = fields) {
  return `SELECT ${extra} FROM pms_bug b JOIN pms_user assignee ON assignee.id=b.assignee_id LEFT JOIN pms_user creator ON creator.id=b.creator_id LEFT JOIN pms_user updater ON updater.id=b.updater_id LEFT JOIN pms_project project ON project.id=b.project_id LEFT JOIN pms_requirement requirement ON requirement.id=b.requirement_id JOIN pms_archive bug_type ON bug_type.id=b.bug_type_id LEFT JOIN pms_archive resolution ON resolution.id=b.resolution_id`
}

function where(q) {
  let sql = ' WHERE b.is_deleted=0'
  const params = []
  if (q.title) { sql += ' AND b.title ILIKE ?'; params.push(`%${q.title}%`) }
  for (const [key, column] of Object.entries({ source_type: 'b.source_type', project_id: 'b.project_id', requirement_id: 'b.requirement_id', bug_type_id: 'b.bug_type_id', severity: 'b.severity', status: 'b.status', assignee_id: 'b.assignee_id', creator_id: 'b.creator_id' })) {
    if (q[key] !== undefined && q[key] !== '') { sql += ` AND ${column}=?`; params.push(Number(q[key])) }
  }
  if (q.created_at_from) { sql += ' AND b.created_at>=?'; params.push(q.created_at_from) }
  if (q.created_at_to) { sql += " AND b.created_at<?::date+INTERVAL '1 day'"; params.push(q.created_at_to) }
  return { sql, params }
}

function getBugSortConfig(sortField, sortOrder) {
  const sortMap = {
    title: 'b.title', sourceName: 'COALESCE(project.name,requirement.title)', assigneeName: 'assignee.real_name',
    bugTypeName: 'bug_type.name', severity: 'b.severity', status: 'b.status', creatorName: 'creator.real_name', createdAt: 'b.created_at'
  }
  return { sort: sortMap[sortField] || 'b.created_at', direction: getSortDirection(sortOrder) }
}

async function count(q) {
  const clause = where(q)
  return Number((await db.prepare(`SELECT COUNT(*) total FROM pms_bug b${clause.sql}`).get(...clause.params))?.total || 0)
}

exports.list = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query)
    const query = { ...req.query }
    if (query.view === 'mine') query.assignee_id = req.user.id
    const clause = where(query)
    const { sort, direction } = getBugSortConfig(query.sort_field, query.sort_order)
    const rows = await db.prepare(base(`COUNT(*) OVER() total,${fields}`) + clause.sql + ` ORDER BY ${sort} ${direction},b.id ${direction} LIMIT ? OFFSET ?`).all(...clause.params, pageSize, offset)
    const common = { ...req.query, view: undefined, assignee_id: req.query.filter_assignee_id }
    ok(res, { list: rows, total: Number(rows[0]?.total || 0), page, pageSize, viewCounts: { all: await count(common), mine: await count({ ...common, assignee_id: req.user.id }) } })
  } catch (error) { console.error(error); fail(res, 500, 500, '查询失败') }
}

exports.neighbors = async (req, res) => {
  try {
    const query = { ...req.query }
    if (query.view === 'mine') query.assignee_id = req.user.id
    const clause = where(query)
    const { sort, direction } = getBugSortConfig(query.sort_field, query.sort_order)
    const row = await db.prepare(`WITH ranked AS(SELECT b.id,LAG(b.id)OVER(ORDER BY ${sort} ${direction},b.id ${direction})prev_id,LEAD(b.id)OVER(ORDER BY ${sort} ${direction},b.id ${direction})next_id,ROW_NUMBER()OVER(ORDER BY ${sort} ${direction},b.id ${direction})ordinal,COUNT(*)OVER()total FROM pms_bug b LEFT JOIN pms_user assignee ON assignee.id=b.assignee_id LEFT JOIN pms_user creator ON creator.id=b.creator_id LEFT JOIN pms_project project ON project.id=b.project_id LEFT JOIN pms_requirement requirement ON requirement.id=b.requirement_id LEFT JOIN pms_archive bug_type ON bug_type.id=b.bug_type_id${clause.sql})SELECT prev_id "prevId",next_id "nextId",ordinal,total FROM ranked WHERE id=?`).get(...clause.params, req.query.id)
    ok(res, row || { prevId: null, nextId: null, total: 0 })
  } catch (error) { console.error(error); fail(res, 500, 500, '查询失败') }
}

exports.projectOptions = async (_req, res) => {
  try { ok(res, await db.prepare('SELECT id,name FROM pms_project WHERE is_deleted=0 ORDER BY name,id').all()) }
  catch (error) { console.error(error); fail(res, 500, 500, '项目选项加载失败') }
}

exports.requirementOptions = async (_req, res) => {
  try { ok(res, await db.prepare('SELECT id,title FROM pms_requirement WHERE is_deleted=0 ORDER BY title,id').all()) }
  catch (error) { console.error(error); fail(res, 500, 500, '需求选项加载失败') }
}

exports.checkTitle = async (req, res) => {
  try {
    const title = String(req.query.title || '').trim()
    if (!title) return ok(res, { available: true })
    const params = [title]
    let sql = 'SELECT id FROM pms_bug WHERE title=? AND is_deleted=0'
    if (req.query.excludeId) { sql += ' AND id<>?'; params.push(Number(req.query.excludeId)) }
    ok(res, { available: !(await db.prepare(sql).get(...params)) })
  } catch (error) { console.error(error); fail(res, 500, 500, '标题校验失败') }
}

exports.getById = async (req, res) => {
  try {
    const row = await db.prepare(base() + ' WHERE b.id=? AND b.is_deleted=0').get(req.params.id)
    row ? ok(res, row) : fail(res, 404, 404, 'BUG不存在')
  } catch (error) { console.error(error); fail(res, 500, 500, '查询失败') }
}

async function validArchive(archiveId, typeName) {
  return db.prepare("SELECT a.id FROM pms_archive a JOIN pms_archive_type t ON t.id=a.archive_type_id WHERE a.id=? AND a.is_deleted=0 AND a.status=1 AND t.is_deleted=0 AND t.status=1 AND t.name=?").get(archiveId, typeName)
}

async function validate(res, body, exclude) {
  if (!body.title?.trim()) { failField(res, 'title', '请填写Bug标题'); return false }
  if (![1, 2].includes(Number(body.source_type))) { failField(res, 'source_type', '请选择关联类型'); return false }
  if (Number(body.source_type) === 1 && !body.project_id) { failField(res, 'project_id', '请选择关联项目'); return false }
  if (Number(body.source_type) === 2 && !body.requirement_id) { failField(res, 'requirement_id', '请选择关联需求'); return false }
  if (!body.bug_type_id) { failField(res, 'bug_type_id', '请选择Bug类型'); return false }
  if (![1, 2, 3, 4].includes(Number(body.severity))) { failField(res, 'severity', '请选择严重程度'); return false }
  if (!body.assignee_id) { failField(res, 'assignee_id', '请选择指派人'); return false }

  const duplicate = exclude
    ? await db.prepare('SELECT id FROM pms_bug WHERE title=? AND is_deleted=0 AND id<>?').get(body.title.trim(), exclude)
    : await db.prepare('SELECT id FROM pms_bug WHERE title=? AND is_deleted=0').get(body.title.trim())
  if (duplicate) { failField(res, 'title', 'Bug标题已存在'); return false }
  if (Number(body.source_type) === 1 && !(await db.prepare('SELECT id FROM pms_project WHERE id=? AND is_deleted=0').get(body.project_id))) { failField(res, 'project_id', '项目不存在或已删除'); return false }
  if (Number(body.source_type) === 2 && !(await db.prepare('SELECT id FROM pms_requirement WHERE id=? AND is_deleted=0').get(body.requirement_id))) { failField(res, 'requirement_id', '需求不存在或已删除'); return false }
  if (!(await db.prepare('SELECT id FROM pms_user WHERE id=? AND is_deleted=0 AND status=1').get(body.assignee_id))) { failField(res, 'assignee_id', '指派人不存在或已停用'); return false }
  if (!(await validArchive(body.bug_type_id, 'Bug类型'))) { failField(res, 'bug_type_id', 'Bug类型不存在或已停用'); return false }
  return true
}

exports.create = async (req, res) => {
  try {
    if (!await validate(res, req.body)) return
    const body = req.body
    const result = await db.prepare('INSERT INTO pms_bug(title,description,source_type,project_id,requirement_id,bug_type_id,severity,status,assignee_id,creator_id,updater_id)VALUES(?,?,?,?,?,?,?,0,?,?,?)').run(body.title.trim(), body.description || null, Number(body.source_type), Number(body.source_type) === 1 ? body.project_id : null, Number(body.source_type) === 2 ? body.requirement_id : null, body.bug_type_id, body.severity, body.assignee_id, req.user.id, req.user.id)
    await db.writeLog(req.user.id, '新增', 'BUG', result.lastInsertRowid, null, null, null, req.ip, body.title.trim())
    ok(res, { id: result.lastInsertRowid })
  } catch (error) { console.error(error); fail(res, 500, 500, '创建失败') }
}

exports.update = async (req, res) => {
  try {
    const old = await db.prepare('SELECT * FROM pms_bug WHERE id=? AND is_deleted=0').get(req.params.id)
    if (!old) return fail(res, 404, 404, 'BUG不存在')
    if (!await validate(res, req.body, Number(req.params.id))) return
    const body = req.body
    const next = {
      title: body.title.trim(), description: body.description || null, source_type: Number(body.source_type),
      project_id: Number(body.source_type) === 1 ? body.project_id : null, requirement_id: Number(body.source_type) === 2 ? body.requirement_id : null,
      bug_type_id: body.bug_type_id, severity: body.severity, assignee_id: body.assignee_id
    }
    await db.prepare('UPDATE pms_bug SET title=?,description=?,source_type=?,project_id=?,requirement_id=?,bug_type_id=?,severity=?,assignee_id=?,updater_id=?,updated_at=NOW()WHERE id=?').run(next.title, next.description, next.source_type, next.project_id, next.requirement_id, next.bug_type_id, next.severity, next.assignee_id, req.user.id, req.params.id)
    const changes = []
    for (const field of Object.keys(next)) if (String(old[field] ?? '') !== String(next[field] ?? '')) changes.push({ field, oldVal: old[field], newVal: next[field] })
    if (changes.length) await db.writeLogs(req.user.id, '编辑', 'BUG', req.params.id, changes, req.ip, next.title)
    ok(res, null)
  } catch (error) { console.error(error); fail(res, 500, 500, '更新失败') }
}

exports.batchAssign = async (req, res) => {
  try {
    const ids = [...new Set((Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    const assigneeId = Number(req.body.assignee_id)
    if (!ids.length) return fail(res, 400, 400, '请选择要指派的 BUG')
    const assignee = await db.prepare('SELECT id,real_name FROM pms_user WHERE id=? AND is_deleted=0 AND status=1').get(assigneeId)
    if (!assignee) return fail(res, 400, 400, '指派人不存在或已停用')
    let updated = 0
    await db.transaction(async (connection) => {
      const rows = await connection.prepare(`SELECT id,title,assignee_id FROM pms_bug WHERE id IN (${ids.map(() => '?').join(',')}) AND is_deleted=0`).all(...ids)
      if (rows.length !== ids.length) throw new Error('部分 BUG 不存在或已删除，请刷新后重试')
      for (const row of rows) {
        if (Number(row.assignee_id) === assigneeId) continue
        await connection.prepare('UPDATE pms_bug SET assignee_id=?,updater_id=?,updated_at=NOW()WHERE id=?').run(assigneeId, req.user.id, row.id)
        await connection.writeLog(req.user.id, '批量指派', 'BUG', row.id, 'assignee_id', row.assignee_id, assigneeId, req.ip, row.title)
        updated += 1
      }
    })
    ok(res, { updated, requested: ids.length })
  } catch (error) { console.error(error); fail(res, 400, 400, error.message || '批量指派失败') }
}

exports.toggleStatus = async (req, res) => {
  try {
    const old = await db.prepare('SELECT id,title,status,resolved_date,closed_date,resolution_id,activation_reason FROM pms_bug WHERE id=? AND is_deleted=0').get(req.params.id)
    if (!old) return fail(res, 404, 404, 'BUG不存在')
    const target = Number(req.body.status)
    if (!allowedBugStatuses(old.status).includes(target)) return fail(res, 400, 400, '不允许执行该状态流转')
    const validationError = validateBugStatusChange(target, req.body)
    if (validationError) return fail(res, 400, 400, validationError)
    if (target === 1 && !(await validArchive(req.body.resolution_id, 'Bug解决方案'))) return failField(res, 'resolution_id', 'Bug解决方案不存在或已停用')
    const next = resolveBugStatusFields(old, target, req.body)
    await db.prepare('UPDATE pms_bug SET status=?,resolved_date=?,closed_date=?,resolution_id=?,activation_reason=?,updater_id=?,updated_at=NOW()WHERE id=?').run(target, next.resolvedDate, next.closedDate, next.resolutionId, next.activationReason, req.user.id, req.params.id)
    const changes = []
    function addChange(field, oldVal, newVal) { if (String(oldVal ?? '') !== String(newVal ?? '')) changes.push({ field, oldVal, newVal }) }
    addChange('status', old.status, target)
    addChange('activation_reason', old.activation_reason, next.activationReason)
    addChange('resolved_date', old.resolved_date, next.resolvedDate)
    addChange('closed_date', old.closed_date, next.closedDate)
    addChange('resolution_id', old.resolution_id, next.resolutionId)
    if (changes.length) await db.writeLogs(req.user.id, '状态变更', 'BUG', req.params.id, changes, req.ip, old.title)
    ok(res, null)
  } catch (error) { console.error(error); fail(res, 500, 500, '操作失败') }
}

exports.remove = async (req, res) => {
  try {
    const row = await db.prepare('SELECT title FROM pms_bug WHERE id=? AND is_deleted=0').get(req.params.id)
    if (!row) return fail(res, 404, 404, 'BUG不存在')
    await db.prepare('UPDATE pms_bug SET is_deleted=1,updater_id=?,updated_at=NOW()WHERE id=?').run(req.user.id, req.params.id)
    await db.writeLog(req.user.id, '删除', 'BUG', req.params.id, 'is_deleted', 0, 1, req.ip, row.title)
    ok(res, null)
  } catch (error) { console.error(error); fail(res, 500, 500, '删除失败') }
}

exports.history = async (req, res) => {
  try {
    const logs = await db.prepare("SELECT l.id,l.operation_id,l.action,l.field_name,l.old_value,l.new_value,l.created_at,COALESCE(u.real_name,'-')operator FROM pms_op_log l LEFT JOIN pms_user u ON u.id=l.user_id WHERE l.module='BUG' AND l.target_id=? ORDER BY l.created_at DESC").all(req.params.id)
    const ids = (field) => [...new Set(logs.filter((log) => log.field_name === field).flatMap((log) => [log.old_value, log.new_value]).map(Number).filter(Number.isFinite))]
    const loadLookup = async (field, sql) => {
      const values = ids(field)
      if (!values.length) return new Map()
      const rows = await db.prepare(`${sql} WHERE id IN (${values.map(() => '?').join(',')})`).all(...values)
      return new Map(rows.map((row) => [String(row.id), row.name]))
    }
    const [projects, requirements, assignees, bugTypes, resolutions] = await Promise.all([
      loadLookup('project_id', 'SELECT id,name FROM pms_project'), loadLookup('requirement_id', 'SELECT id,title name FROM pms_requirement'),
      loadLookup('assignee_id', 'SELECT id,real_name name FROM pms_user'), loadLookup('bug_type_id', 'SELECT id,name FROM pms_archive'),
      loadLookup('resolution_id', 'SELECT id,name FROM pms_archive')
    ])
    const valueLookups = {
      source_type: new Map([['1', '项目'], ['2', '需求']]), project_id: projects, requirement_id: requirements,
      assignee_id: assignees, bug_type_id: bugTypes, resolution_id: resolutions,
      severity: new Map([['1', '低'], ['2', '中'], ['3', '高'], ['4', '致命']]),
      status: new Map([['0', '新建'], ['1', '已修复'], ['2', '已关闭'], ['3', '被激活']])
    }
    ok(res, groupOperationLogs(logs, DETAIL_FIELD_ORDER).map((group) => ({ ...group, changes: formatHistoryChanges(group.changes, { fieldLabels: HISTORY_FIELD_LABELS, dateFields: HISTORY_DATE_FIELDS, valueLookups }) })))
  } catch (error) { console.error(error); fail(res, 500, 500, '查询失败') }
}
