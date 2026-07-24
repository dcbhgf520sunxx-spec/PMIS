const db = require('../db')
const { parsePagination, getSortDirection } = require('../utils/pagination')
const { ok, fail, failField } = require('../utils/response')
const { formatHistoryChanges, groupOperationLogs } = require('../utils/operationHistory')
const { allowedTaskStatuses, validateTaskStatusChange, resolveTaskStatusFields, calculateTaskOverdue, canCompleteParent, canLeaveCompletedSubtask } = require('../services/taskRules')

const DETAIL_FIELD_ORDER = ['name', 'description', 'parent_task_id', 'source_type', 'project_id', 'requirement_id', 'owner_id', 'owner_ids', 'task_type', 'priority', 'status', 'is_overdue', 'start_date', 'expected_end_date', 'actual_end_date', 'suspend_date']
const HISTORY_FIELD_LABELS = {
  name: '任务名称', description: '任务描述', parent_task_id: '所属主任务', source_type: '关联类型', project_id: '关联项目', requirement_id: '关联需求',
  owner_id: '负责人', owner_ids: '负责人', task_type: '任务类型', priority: '优先级', status: '任务状态', is_overdue: '逾期状态',
  start_date: '启动时间', expected_end_date: '预计完成时间', actual_end_date: '实际完成时间', suspend_date: '暂停时间'
}
const HISTORY_DATE_FIELDS = new Set(['start_date', 'expected_end_date', 'actual_end_date', 'suspend_date'])
const ownerNamesSql = `(SELECT STRING_AGG(owner_user.real_name,'、' ORDER BY task_owner.sort_order,task_owner.user_id) FROM pms_task_owner task_owner JOIN pms_user owner_user ON owner_user.id=task_owner.user_id WHERE task_owner.task_id=t.id)`
const fields = `t.*,COALESCE((SELECT JSON_AGG(JSON_BUILD_OBJECT('id',owner_user.id,'name',owner_user.real_name) ORDER BY task_owner.sort_order,task_owner.user_id) FROM pms_task_owner task_owner JOIN pms_user owner_user ON owner_user.id=task_owner.user_id WHERE task_owner.task_id=t.id),'[]'::json) owners,COALESCE(${ownerNamesSql},'') owner_names,creator.real_name creator_name,updater.real_name updater_name,project.name project_name,requirement.title requirement_name,archive.name task_type_name,parent.name parent_task_name,(SELECT COUNT(*)::INTEGER FROM pms_task child WHERE child.parent_task_id=t.id AND child.is_deleted=0)child_count,(SELECT COUNT(*)::INTEGER FROM pms_task child WHERE child.parent_task_id=t.id AND child.is_deleted=0 AND child.status=2)completed_child_count,CASE WHEN t.status=3 THEN(SELECT old_value::INTEGER FROM pms_op_log l WHERE l.module='任务' AND l.target_id=t.id AND l.action='状态变更' AND l.field_name='status' AND l.new_value='3' ORDER BY l.created_at DESC LIMIT 1)END previous_status`
const taskJoins = ` FROM pms_task t LEFT JOIN pms_user creator ON creator.id=t.creator_id LEFT JOIN pms_user updater ON updater.id=t.updater_id LEFT JOIN pms_project project ON project.id=t.project_id LEFT JOIN pms_requirement requirement ON requirement.id=t.requirement_id JOIN pms_archive archive ON archive.id=t.task_type LEFT JOIN pms_task parent ON parent.id=t.parent_task_id`

function base(extra = fields) {
  return `SELECT ${extra}${taskJoins}`
}

function where(q) {
  let sql = ' WHERE t.is_deleted=0'
  const params = []
  if (q.name) {
    sql += ' AND t.name ILIKE ?'
    params.push(`%${q.name}%`)
  }
  for (const [key, column] of Object.entries({ source_type: 't.source_type', project_id: 't.project_id', requirement_id: 't.requirement_id', task_type: 't.task_type', priority: 't.priority', status: 't.status', is_overdue: 't.is_overdue' })) {
    if (q[key] !== undefined && q[key] !== '') {
      sql += ` AND ${column}=?`
      params.push(Number(q[key]))
    }
  }
  if (q.owner_id !== undefined && q.owner_id !== '') {
    sql += ' AND EXISTS (SELECT 1 FROM pms_task_owner task_owner WHERE task_owner.task_id=t.id AND task_owner.user_id=?)'
    params.push(Number(q.owner_id))
  }
  for (const [key, column, operator] of [['expected_end_date_from', 't.expected_end_date', '>='], ['expected_end_date_to', 't.expected_end_date', '<=']]) {
    if (q[key]) {
      sql += ` AND ${column}${operator}?`
      params.push(q[key])
    }
  }
  return { sql, params }
}

function getTaskSortConfig(sortField, sortOrder) {
  const sortMap = {
    name: 't.name',
    sourceName: 'COALESCE(project.name,requirement.title)',
    ownerNames: `COALESCE(${ownerNamesSql},'')`,
    taskTypeName: 'archive.name',
    priority: 't.priority',
    status: 't.status',
    expectedEndTime: 't.expected_end_date',
    createdAt: 't.created_at'
  }
  return {
    sort: sortMap[sortField] || 't.created_at',
    direction: getSortDirection(sortOrder)
  }
}

async function count(q) {
  const clause = where(q)
  return Number((await db.prepare(`SELECT COUNT(*) total FROM pms_task t${clause.sql}`).get(...clause.params))?.total || 0)
}

exports.list = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query)
    const query = { ...req.query }
    if (query.view === 'mine') query.owner_id = req.user.id
    const clause = where(query)
    const { sort, direction } = getTaskSortConfig(query.sort_field, query.sort_order)
    const rows = await db.prepare(`WITH matched AS(SELECT t.id,COALESCE(t.parent_task_id,t.id)root_id,${sort} sort_value${taskJoins}${clause.sql}),task_groups AS(SELECT root_id,MIN(sort_value)group_sort FROM matched GROUP BY root_id),paged_groups AS(SELECT root_id,group_sort FROM task_groups ORDER BY group_sort ${direction} NULLS LAST,root_id ${direction} LIMIT ? OFFSET ?)SELECT(SELECT COUNT(*) FROM task_groups)::INTEGER total,${fields}${taskJoins} JOIN paged_groups pg ON pg.root_id=COALESCE(t.parent_task_id,t.id) WHERE t.is_deleted=0 AND(t.id IN (SELECT id FROM matched) OR t.id=pg.root_id) ORDER BY pg.group_sort ${direction} NULLS LAST,pg.root_id ${direction},CASE WHEN t.parent_task_id IS NULL THEN 0 ELSE 1 END,${sort} ${direction},t.id ${direction}`).all(...clause.params, pageSize, offset)
    const common = { ...req.query, view: undefined, owner_id: req.query.filter_owner_id }
    ok(res, { list: rows, total: Number(rows[0]?.total || 0), page, pageSize, viewCounts: { all: await count(common), mine: await count({ ...common, owner_id: req.user.id }) } })
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '查询失败')
  }
}

exports.neighbors = async (req, res) => {
  try {
    const query = { ...req.query }
    if (query.view === 'mine') query.owner_id = req.user.id
    const clause = where(query)
    const { sort, direction } = getTaskSortConfig(query.sort_field, query.sort_order)
    const row = await db.prepare(`WITH matched AS(SELECT t.id,COALESCE(t.parent_task_id,t.id)root_id,${sort} sort_value${taskJoins}${clause.sql}),task_groups AS(SELECT root_id,MIN(sort_value)group_sort FROM matched GROUP BY root_id),visible AS(SELECT t.id,t.parent_task_id,pg.root_id,pg.group_sort,${sort} sort_value${taskJoins} JOIN task_groups pg ON pg.root_id=COALESCE(t.parent_task_id,t.id) WHERE t.is_deleted=0 AND(t.id IN(SELECT id FROM matched)OR t.id=pg.root_id)),ranked AS(SELECT id,LAG(id)OVER(ORDER BY group_sort ${direction} NULLS LAST,root_id ${direction},CASE WHEN parent_task_id IS NULL THEN 0 ELSE 1 END,sort_value ${direction},id ${direction})prev_id,LEAD(id)OVER(ORDER BY group_sort ${direction} NULLS LAST,root_id ${direction},CASE WHEN parent_task_id IS NULL THEN 0 ELSE 1 END,sort_value ${direction},id ${direction})next_id,ROW_NUMBER()OVER(ORDER BY group_sort ${direction} NULLS LAST,root_id ${direction},CASE WHEN parent_task_id IS NULL THEN 0 ELSE 1 END,sort_value ${direction},id ${direction})ordinal,COUNT(*)OVER()total FROM visible)SELECT prev_id "prevId",next_id "nextId",ordinal,total FROM ranked WHERE id=?`).get(...clause.params, req.query.id)
    ok(res, row || { prevId: null, nextId: null, total: 0 })
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '查询失败')
  }
}

exports.projectOptions = async (_req, res) => {
  try {
    ok(res, await db.prepare('SELECT id,name FROM pms_project WHERE is_deleted=0 ORDER BY name,id').all())
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '项目选项加载失败')
  }
}

exports.requirementOptions = async (_req, res) => {
  try {
    ok(res, await db.prepare('SELECT id,title FROM pms_requirement WHERE is_deleted=0 ORDER BY title,id').all())
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '需求选项加载失败')
  }
}

exports.checkName = async (req, res) => {
  try {
    const name = String(req.query.name || '').trim()
    if (!name) return ok(res, { available: true })
    const params = [name]
    let sql = 'SELECT id FROM pms_task WHERE name=? AND is_deleted=0'
    if (req.query.excludeId) {
      sql += ' AND id<>?'
      params.push(Number(req.query.excludeId))
    }
    ok(res, { available: !(await db.prepare(sql).get(...params)) })
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '名称校验失败')
  }
}

exports.getById = async (req, res) => {
  try {
    const row = await db.prepare(base() + ' WHERE t.id=? AND t.is_deleted=0').get(req.params.id)
    row ? ok(res, row) : fail(res, 404, 404, '任务不存在')
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '查询失败')
  }
}

exports.listSubtasks = async (req, res) => {
  try {
    const parentTask = await db.prepare('SELECT id,parent_task_id FROM pms_task WHERE id=? AND is_deleted=0').get(req.params.id)
    if (!parentTask) return fail(res, 404, 404, '任务不存在')
    if (parentTask.parent_task_id) return fail(res, 400, 400, '父任务必须是主任务')
    ok(res, await db.prepare(base() + ' WHERE t.parent_task_id=? AND t.is_deleted=0 ORDER BY t.created_at,t.id').all(req.params.id))
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '子任务加载失败')
  }
}

function normalizeOwnerIds(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))]
}

async function loadOwners(connection, taskId) {
  return connection.prepare(`SELECT task_owner.user_id id,owner_user.real_name name
    FROM pms_task_owner task_owner JOIN pms_user owner_user ON owner_user.id=task_owner.user_id
    WHERE task_owner.task_id=? ORDER BY task_owner.sort_order,task_owner.user_id`).all(taskId)
}

async function loadUsers(connection, ownerIds) {
  if (!ownerIds.length) return []
  const rows = await connection.prepare(`SELECT id,real_name name FROM pms_user
    WHERE id IN (${ownerIds.map(() => '?').join(',')}) AND is_deleted=0 AND status=1`).all(...ownerIds)
  const usersById = new Map(rows.map((row) => [Number(row.id), row]))
  return ownerIds.map((id) => usersById.get(id)).filter(Boolean)
}

async function saveOwners(connection, taskId, ownerIds) {
  await connection.prepare('DELETE FROM pms_task_owner WHERE task_id=?').run(taskId)
  for (const [index, userId] of ownerIds.entries()) {
    await connection.prepare('INSERT INTO pms_task_owner(task_id,user_id,sort_order)VALUES(?,?,?) RETURNING task_id AS id').run(taskId, userId, index)
  }
}

function ownerNames(owners) {
  return owners.map((owner) => owner.name).join('、')
}

async function validate(res, body, exclude) {
  if (!body.name?.trim()) {
    failField(res, 'name', '请填写任务名称')
    return false
  }
  const ownerIds = normalizeOwnerIds(body.owner_ids)
  if (!ownerIds.length) {
    failField(res, 'owner_ids', '请选择负责人')
    return false
  }
  if (!body.task_type) {
    failField(res, 'task_type', '请选择任务类型')
    return false
  }
  if (![1, 2].includes(Number(body.source_type))) {
    failField(res, 'source_type', '请选择关联类型')
    return false
  }
  if (Number(body.source_type) === 1 && !body.project_id) {
    failField(res, 'project_id', '请选择关联项目')
    return false
  }
  if (Number(body.source_type) === 2 && !body.requirement_id) {
    failField(res, 'requirement_id', '请选择关联需求')
    return false
  }

  const duplicate = exclude
    ? await db.prepare('SELECT id FROM pms_task WHERE name=? AND is_deleted=0 AND id<>?').get(body.name.trim(), exclude)
    : await db.prepare('SELECT id FROM pms_task WHERE name=? AND is_deleted=0').get(body.name.trim())
  if (duplicate) {
    failField(res, 'name', '任务名称已存在')
    return false
  }

  if (Number(body.source_type) === 1 && !(await db.prepare('SELECT id FROM pms_project WHERE id=? AND is_deleted=0').get(body.project_id))) {
    failField(res, 'project_id', '项目不存在或已删除')
    return false
  }
  if (Number(body.source_type) === 2 && !(await db.prepare('SELECT id FROM pms_requirement WHERE id=? AND is_deleted=0').get(body.requirement_id))) {
    failField(res, 'requirement_id', '需求不存在或已删除')
    return false
  }
  const owners = await loadUsers(db, ownerIds)
  if (owners.length !== ownerIds.length) {
    failField(res, 'owner_ids', '部分负责人不存在或已停用')
    return false
  }
  if (!(await db.prepare("SELECT a.id FROM pms_archive a JOIN pms_archive_type t ON t.id=a.archive_type_id WHERE a.id=? AND a.is_deleted=0 AND a.status=1 AND t.is_deleted=0 AND t.status=1 AND t.name='任务类型'").get(body.task_type))) {
    failField(res, 'task_type', '任务类型不存在或已停用')
    return false
  }
  return true
}

exports.create = async (req, res) => {
  try {
    if (!await validate(res, req.body)) return
    const body = req.body
    const overdue = calculateTaskOverdue(body.expected_end_date, 0)
    let result
    await db.transaction(async (connection) => {
      result = await connection.prepare('INSERT INTO pms_task(name,description,source_type,project_id,requirement_id,task_type,priority,status,is_overdue,start_date,expected_end_date,creator_id,updater_id)VALUES(?,?,?,?,?,?,?,0,?,?,?,?,?)').run(body.name.trim(), body.description || null, Number(body.source_type), Number(body.source_type) === 1 ? body.project_id : null, Number(body.source_type) === 2 ? body.requirement_id : null, body.task_type, body.priority ?? 1, overdue, body.start_date || null, body.expected_end_date || null, req.user.id, req.user.id)
      await saveOwners(connection, result.lastInsertRowid, normalizeOwnerIds(body.owner_ids))
      await connection.writeLog(req.user.id, '新增', '任务', result.lastInsertRowid, null, null, null, req.ip, body.name.trim())
    })
    ok(res, { id: result.lastInsertRowid })
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '创建失败')
  }
}

exports.createSubtask = async (req, res) => {
  try {
    const parentTask = await db.prepare('SELECT * FROM pms_task WHERE id=? AND is_deleted=0').get(req.params.id)
    if (!parentTask) return fail(res, 404, 404, '任务不存在')
    if (parentTask.parent_task_id) return fail(res, 400, 400, '父任务必须是主任务')
    if (Number(parentTask.status) === 2) return fail(res, 400, 400, '已完成的主任务不能新增子任务')
    const body = {
      ...req.body,
      source_type: parentTask.source_type,
      project_id: parentTask.project_id,
      requirement_id: parentTask.requirement_id,
    }
    if (!await validate(res, body)) return
    const overdue = calculateTaskOverdue(body.expected_end_date, 0)
    let result
    await db.transaction(async (connection) => {
      result = await connection.prepare('INSERT INTO pms_task(name,description,parent_task_id,source_type,project_id,requirement_id,task_type,priority,status,is_overdue,start_date,expected_end_date,creator_id,updater_id)VALUES(?,?,?,?,?,?,?,?,0,?,?,?,?,?)').run(body.name.trim(), body.description || null, parentTask.id, parentTask.source_type, parentTask.project_id, parentTask.requirement_id, body.task_type, body.priority ?? 1, overdue, body.start_date || null, body.expected_end_date || null, req.user.id, req.user.id)
      await saveOwners(connection, result.lastInsertRowid, normalizeOwnerIds(body.owner_ids))
      await connection.writeLog(req.user.id, '新增', '任务', result.lastInsertRowid, 'parent_task_id', null, parentTask.id, req.ip, body.name.trim())
    })
    ok(res, { id: result.lastInsertRowid })
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '创建子任务失败')
  }
}

exports.update = async (req, res) => {
  try {
    const old = await db.prepare('SELECT * FROM pms_task WHERE id=? AND is_deleted=0').get(req.params.id)
    if (!old) return fail(res, 404, 404, '任务不存在')
    const oldOwners = await loadOwners(db, req.params.id)
    const requestedBody = req.body
    const childCount = Number((await db.prepare('SELECT COUNT(*) count FROM pms_task WHERE parent_task_id=? AND is_deleted=0').get(req.params.id))?.count || 0)
    if (!old.parent_task_id && childCount > 0) {
      const sourceChanged = Number(requestedBody.source_type) !== Number(old.source_type)
        || String(requestedBody.project_id || '') !== String(old.project_id || '')
        || String(requestedBody.requirement_id || '') !== String(old.requirement_id || '')
      if (sourceChanged) return fail(res, 400, 400, '存在子任务时不能修改关联对象')
    }
    const body = old.parent_task_id ? { ...requestedBody, source_type: old.source_type, project_id: old.project_id, requirement_id: old.requirement_id } : requestedBody
    if (!await validate(res, body, Number(req.params.id))) return
    const overdue = calculateTaskOverdue(body.expected_end_date, old.status)
    const changes = []
    for (const field of ['name', 'description', 'source_type', 'project_id', 'requirement_id', 'task_type', 'priority', 'is_overdue', 'start_date', 'expected_end_date']) {
      const next = field === 'is_overdue' ? overdue : (field === 'project_id' && Number(body.source_type) !== 1 ? null : field === 'requirement_id' && Number(body.source_type) !== 2 ? null : body[field])
      if (String(old[field] ?? '') !== String(next ?? '')) changes.push({ field, oldVal: old[field], newVal: next })
    }
    const nextOwnerIds = normalizeOwnerIds(body.owner_ids)
    const oldOwnerIds = oldOwners.map((owner) => Number(owner.id))
    const nextOwners = await loadUsers(db, nextOwnerIds)
    if (oldOwnerIds.join(',') !== nextOwnerIds.join(',')) changes.push({ field: 'owner_ids', oldVal: ownerNames(oldOwners), newVal: ownerNames(nextOwners) })
    await db.transaction(async (connection) => {
      await connection.prepare('UPDATE pms_task SET name=?,description=?,source_type=?,project_id=?,requirement_id=?,task_type=?,priority=?,is_overdue=?,start_date=?,expected_end_date=?,updater_id=?,updated_at=NOW()WHERE id=?').run(body.name.trim(), body.description || null, body.source_type, Number(body.source_type) === 1 ? body.project_id : null, Number(body.source_type) === 2 ? body.requirement_id : null, body.task_type, body.priority ?? 1, overdue, body.start_date || null, body.expected_end_date || null, req.user.id, req.params.id)
      await saveOwners(connection, req.params.id, nextOwnerIds)
      if (changes.length) await connection.writeLogs(req.user.id, '编辑', '任务', req.params.id, changes, req.ip, body.name.trim())
    })
    ok(res, null)
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '更新失败')
  }
}

exports.batchAssign = async (req, res) => {
  try {
    const ids = [...new Set((Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    const ownerIds = normalizeOwnerIds(req.body.owner_ids)
    if (!ids.length) return fail(res, 400, 400, '请选择要指派的任务')
    if (!ownerIds.length) return failField(res, 'owner_ids', '请选择负责人')
    const nextOwners = await loadUsers(db, ownerIds)
    if (nextOwners.length !== ownerIds.length) return failField(res, 'owner_ids', '部分负责人不存在或已停用')
    let updated = 0
    await db.transaction(async (connection) => {
      const rows = await connection.prepare(`SELECT id,name FROM pms_task WHERE id IN (${ids.map(() => '?').join(',')}) AND is_deleted=0`).all(...ids)
      if (rows.length !== ids.length) throw new Error('部分任务不存在或已删除，请刷新后重试')
      for (const row of rows) {
        const oldOwners = await loadOwners(connection, row.id)
        if (oldOwners.map((owner) => Number(owner.id)).join(',') === ownerIds.join(',')) continue
        await saveOwners(connection, row.id, ownerIds)
        await connection.prepare('UPDATE pms_task SET updater_id=?,updated_at=NOW()WHERE id=?').run(req.user.id, row.id)
        await connection.writeLog(req.user.id, '批量指派', '任务', row.id, 'owner_ids', ownerNames(oldOwners), ownerNames(nextOwners), req.ip, row.name)
        updated += 1
      }
    })
    ok(res, { updated, requested: ids.length })
  } catch (error) {
    console.error(error)
    fail(res, 400, 400, error.message || '批量指派失败')
  }
}

exports.toggleStatus = async (req, res) => {
  try {
    const old = await db.prepare(`SELECT t.id,t.name,t.parent_task_id,t.status,t.is_overdue,t.expected_end_date,t.actual_end_date,t.suspend_date,parent.status parent_status,CASE WHEN t.status=3 THEN(SELECT old_value::INTEGER FROM pms_op_log l WHERE l.module='任务' AND l.target_id=t.id AND l.action='状态变更' AND l.field_name='status' AND l.new_value='3' ORDER BY l.created_at DESC LIMIT 1)END previous_status FROM pms_task t LEFT JOIN pms_task parent ON parent.id=t.parent_task_id WHERE t.id=? AND t.is_deleted=0`).get(req.params.id)
    if (!old) return fail(res, 404, 404, '任务不存在')
    const target = Number(req.body.status)
    if (!allowedTaskStatuses(old.status, old.previous_status).includes(target)) return fail(res, 400, 400, '不允许执行该状态流转')
    if (!old.parent_task_id && target === 2) {
      const childStats = await db.prepare('SELECT COUNT(*)::INTEGER total,COUNT(*) FILTER(WHERE status=2)::INTEGER completed FROM pms_task WHERE parent_task_id=? AND is_deleted=0').get(old.id)
      const incompleteCount = Number(childStats.total) - Number(childStats.completed)
      if (!canCompleteParent(childStats.completed, childStats.total)) return fail(res, 400, 400, `主任务下还有 ${incompleteCount} 个未完成子任务，不能完成主任务`)
    }
    if (old.parent_task_id && Number(old.status) === 2 && target !== 2 && !canLeaveCompletedSubtask(old.parent_status)) return fail(res, 400, 400, '主任务已完成，请先调整主任务状态')
    const validationError = validateTaskStatusChange(target, req.body)
    if (validationError) return fail(res, 400, 400, validationError)
    const nextFields = resolveTaskStatusFields(old, target, req.body)
    const overdue = calculateTaskOverdue(old.expected_end_date, target)
    await db.prepare('UPDATE pms_task SET status=?,actual_end_date=?,suspend_date=?,is_overdue=?,updater_id=?,updated_at=NOW()WHERE id=?').run(target, nextFields.actualEndDate, nextFields.suspendDate, overdue, req.user.id, req.params.id)
    const changes = []
    function addChange(field, oldVal, newVal) {
      if (String(oldVal ?? '') !== String(newVal ?? '')) changes.push({ field, oldVal, newVal })
    }
    addChange('status', old.status, target)
    addChange('actual_end_date', old.actual_end_date, nextFields.actualEndDate)
    addChange('suspend_date', old.suspend_date, nextFields.suspendDate)
    addChange('is_overdue', old.is_overdue, overdue)
    if (changes.length) await db.writeLogs(req.user.id, '状态变更', '任务', req.params.id, changes, req.ip, old.name)
    let allSubtasksCompleted = false
    if (old.parent_task_id && target === 2) {
      const childStats = await db.prepare('SELECT COUNT(*)::INTEGER total,COUNT(*) FILTER(WHERE status=2)::INTEGER completed FROM pms_task WHERE parent_task_id=? AND is_deleted=0').get(old.parent_task_id)
      allSubtasksCompleted = Number(childStats.total) > 0 && canCompleteParent(childStats.completed, childStats.total)
    }
    ok(res, { allSubtasksCompleted, parentTaskId: old.parent_task_id || null })
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '操作失败')
  }
}

exports.remove = async (req, res) => {
  try {
    const row = await db.prepare('SELECT name FROM pms_task WHERE id=? AND is_deleted=0').get(req.params.id)
    if (!row) return fail(res, 404, 404, '任务不存在')
    const childCount = Number((await db.prepare('SELECT COUNT(*) count FROM pms_task WHERE parent_task_id=? AND is_deleted=0').get(req.params.id))?.count || 0)
    if (childCount > 0) return fail(res, 400, 400, `该主任务下还有 ${childCount} 个子任务，不能删除`)
    await db.prepare('UPDATE pms_task SET is_deleted=1,updater_id=?,updated_at=NOW()WHERE id=?').run(req.user.id, req.params.id)
    await db.writeLog(req.user.id, '删除', '任务', req.params.id, 'is_deleted', 0, 1, req.ip, row.name)
    ok(res, null)
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '删除失败')
  }
}

exports.history = async (req, res) => {
  try {
    const logs = await db.prepare("SELECT l.id,l.operation_id,l.action,l.field_name,l.old_value,l.new_value,l.created_at,COALESCE(u.real_name,'-')operator FROM pms_op_log l LEFT JOIN pms_user u ON u.id=l.user_id WHERE l.module='任务' AND l.target_id=? ORDER BY l.created_at DESC").all(req.params.id)
    const ids = (field) => [...new Set(logs.filter((log) => log.field_name === field).flatMap((log) => [log.old_value, log.new_value]).map(Number).filter(Number.isFinite))]
    const loadLookup = async (field, sql) => {
      const values = ids(field)
      if (!values.length) return new Map()
      const rows = await db.prepare(`${sql} WHERE id IN (${values.map(() => '?').join(',')})`).all(...values)
      return new Map(rows.map((row) => [String(row.id), row.name]))
    }
    const [projects, requirements, parents, taskTypes, owners] = await Promise.all([
      loadLookup('project_id', 'SELECT id,name FROM pms_project'),
      loadLookup('requirement_id', 'SELECT id,title name FROM pms_requirement'),
      loadLookup('parent_task_id', 'SELECT id,name FROM pms_task'),
      loadLookup('task_type', 'SELECT id,name FROM pms_archive'),
      loadLookup('owner_id', 'SELECT id,real_name name FROM pms_user')
    ])
    const valueLookups = {
      source_type: new Map([['1', '项目'], ['2', '需求']]), project_id: projects, requirement_id: requirements, parent_task_id: parents, task_type: taskTypes,
      owner_id: owners,
      priority: new Map([['0', '低'], ['1', '中'], ['2', '高']]), status: new Map([['0', '待处理'], ['1', '处理中'], ['2', '已完成'], ['3', '已暂停']]),
      is_overdue: new Map([['0', '未逾期'], ['1', '已逾期']])
    }
    ok(res, groupOperationLogs(logs, DETAIL_FIELD_ORDER).map((group) => ({
      ...group,
      changes: formatHistoryChanges(group.changes, { fieldLabels: HISTORY_FIELD_LABELS, dateFields: HISTORY_DATE_FIELDS, valueLookups })
    })))
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '查询失败')
  }
}
