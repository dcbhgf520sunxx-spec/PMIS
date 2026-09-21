const { calculateOverdue, overdueSql } = require('./overdueRules')
const db = require('../db')
const { summarizeRichText } = require('../mcp/contentPolicy')
const { validatePeriodDetailQuery, paginatePeriodDetails, createPeriodDatasetToken, assertPeriodDatasetToken } = require('./mcpPeriodDetails')
const { calculateRequirementOverdue } = require('./requirementRules')
const { PERIOD_SECTIONS } = require('./mcpPeriodConstants')

const SHANGHAI_TIME_ZONE = 'Asia/Shanghai'
const MAX_PERIOD_DAYS = 3660
const DEFAULT_DETAIL_LIMIT = 20
const MAX_DETAIL_LIMIT = 100

const BUSINESS_TYPES = {
  project: {
    label: '项目', menu: '/projects', module: '项目', completed: [2], paused: [3], inProgress: [1],
  },
  requirement: {
    label: '需求', menu: '/requirements', module: '需求', completed: [33, 34], paused: [35], inProgress: [31, 32],
  },
  stage_plan: {
    label: '阶段关键事项', menu: '/projects', module: '项目阶段主计划', completed: [2], paused: [3], inProgress: [1],
  },
  task: {
    label: '任务', menu: '/tasks', module: '任务', completed: [2], paused: [3], inProgress: [1],
  },
  bug: {
    label: 'BUG', menu: '/bugs', module: 'BUG', completed: [2], paused: [], inProgress: [0, 1, 3],
  },
  work_order: {
    label: '运维工单', menu: '/work-orders', module: '运维工单', completed: [2], paused: [4], inProgress: [1, 5],
  },
}

const RECORD_QUERIES = {
  project: `/* period_analysis:records:project */
    SELECT 'project' business_type,p.id,p.name,p.status,p.priority,
      product.id product_id,product.name product_name,p.id project_id,p.name project_name,
      p.requirement_id,requirement.title requirement_name,p.owner_id,owner.real_name owner_name,
      p.creator_id,p.updater_id,
      ARRAY[p.owner_id] owner_ids,
      ARRAY_REMOVE(ARRAY[p.owner_id] || COALESCE((SELECT ARRAY_AGG(member.user_id ORDER BY member.user_id)
        FROM pms_project_member member WHERE member.project_id=p.id),'{}'::BIGINT[]),NULL) business_role_ids,
      ARRAY_REMOVE(ARRAY[p.owner_id,p.creator_id] || COALESCE((SELECT ARRAY_AGG(member.user_id ORDER BY member.user_id)
        FROM pms_project_member member WHERE member.project_id=p.id),'{}'::BIGINT[]),NULL) person_ids,
      p.expected_end_date plan_date,p.actual_end_date actual_date,p.suspend_date pause_date,
      p.created_at,${overdueSql('project', {alias:'p'}).fields},(p.status=3) is_paused,(p.status=2) is_completed,
      FALSE parent_project_paused,FALSE required_delivery,0 delivery_count
    FROM pms_project p
    JOIN pms_product product ON product.id=p.product_id
    LEFT JOIN pms_requirement requirement ON requirement.id=p.requirement_id
    LEFT JOIN pms_user owner ON owner.id=p.owner_id
    WHERE p.is_deleted=0`,
  requirement: `/* period_analysis:records:requirement */
    SELECT 'requirement' business_type,r.id,r.title name,r.status,r.priority,
      product.id product_id,product.name product_name,NULL::BIGINT project_id,NULL::TEXT project_name,
      r.id requirement_id,r.title requirement_name,r.owner_id,owner.real_name owner_name,
      r.creator_id,r.updater_id,ARRAY[r.owner_id] owner_ids,
      ARRAY_REMOVE(ARRAY[r.owner_id],NULL) business_role_ids,
      ARRAY_REMOVE(ARRAY[r.owner_id,r.creator_id],NULL) person_ids,
      r.expected_end_date plan_date,r.actual_end_date actual_date,r.pause_date,
      r.created_at,${overdueSql('requirement', {alias:'r'}).fields},(r.status=35) is_paused,
      (r.status IN (33,34)) is_completed,FALSE parent_project_paused,FALSE required_delivery,0 delivery_count
    FROM pms_requirement r
    JOIN pms_product product ON product.id=r.product_id
    LEFT JOIN pms_user owner ON owner.id=r.owner_id
    WHERE r.is_deleted=0`,
  stage_plan: `/* period_analysis:records:stage_plan */
    SELECT 'stage_plan' business_type,item.id,item.name,item.status,project.priority,
      product.id product_id,product.name product_name,project.id project_id,project.name project_name,
      project.requirement_id,requirement.title requirement_name,item.owner_id,owner.real_name owner_name,
      item.creator_id,item.updater_id,
      ARRAY[item.owner_id] || COALESCE((SELECT ARRAY_AGG(c.user_id ORDER BY c.sort_order,c.user_id)
        FROM pms_project_plan_item_collaborator c WHERE c.plan_item_id=item.id),'{}'::BIGINT[]) owner_ids,
      ARRAY_REMOVE(ARRAY[item.owner_id] || COALESCE((SELECT ARRAY_AGG(c.user_id ORDER BY c.sort_order,c.user_id)
        FROM pms_project_plan_item_collaborator c WHERE c.plan_item_id=item.id),'{}'::BIGINT[]),NULL) business_role_ids,
      ARRAY_REMOVE(ARRAY[item.owner_id,item.creator_id] || COALESCE((SELECT ARRAY_AGG(c.user_id ORDER BY c.sort_order,c.user_id)
        FROM pms_project_plan_item_collaborator c WHERE c.plan_item_id=item.id),'{}'::BIGINT[]),NULL) person_ids,
      item.current_due_date plan_date,item.actual_end_date actual_date,item.created_at,
      ${overdueSql('stage_plan', {alias:'item',parentAlias:'project'}).fields},
      (item.status=3) is_paused,(item.status=2) is_completed,(project.status=3) parent_project_paused,
      (item.requires_delivery_file=1) required_delivery,
      (SELECT COUNT(*)::INTEGER FROM pms_project_plan_delivery_file f
        WHERE f.plan_item_id=item.id AND f.is_current=1 AND f.is_void=0) delivery_count
    FROM pms_project_plan_item item
    JOIN pms_project_plan_stage stage ON stage.id=item.stage_id AND stage.is_deleted=0
    JOIN pms_project project ON project.id=stage.project_id AND project.is_deleted=0
    JOIN pms_product product ON product.id=project.product_id
    LEFT JOIN pms_requirement requirement ON requirement.id=project.requirement_id
    LEFT JOIN pms_user owner ON owner.id=item.owner_id
    WHERE item.is_deleted=0`,
  task: `/* period_analysis:records:task */
    SELECT 'task' business_type,t.id,t.name,t.status,t.priority,
      COALESCE(project.product_id,requirement.product_id) product_id,product.name product_name,
      t.project_id,project.name project_name,t.requirement_id,requirement.title requirement_name,
      t.creator_id,t.updater_id,
      owners.owner_id,owners.owner_name,COALESCE(owners.owner_ids,'{}'::BIGINT[]) owner_ids,
      COALESCE(owners.owner_ids,'{}'::BIGINT[]) business_role_ids,
      ARRAY_REMOVE(COALESCE(owners.owner_ids,'{}'::BIGINT[]) || ARRAY[t.creator_id],NULL) person_ids,
      t.expected_end_date plan_date,t.actual_end_date actual_date,t.suspend_date pause_date,t.created_at,${overdueSql('task', {alias:'t'}).fields},
      (t.status=3) is_paused,(t.status=2) is_completed,FALSE parent_project_paused,
      FALSE required_delivery,0 delivery_count,t.parent_task_id
    FROM pms_task t
    LEFT JOIN pms_project project ON project.id=t.project_id
    LEFT JOIN pms_requirement requirement ON requirement.id=t.requirement_id
    LEFT JOIN pms_product product ON product.id=COALESCE(project.product_id,requirement.product_id)
    LEFT JOIN LATERAL (SELECT MIN(o.user_id) owner_id,
      STRING_AGG(u.real_name,'、' ORDER BY o.sort_order,o.user_id) owner_name,
      ARRAY_AGG(o.user_id ORDER BY o.sort_order,o.user_id) owner_ids
      FROM pms_task_owner o JOIN pms_user u ON u.id=o.user_id WHERE o.task_id=t.id) owners ON TRUE
    WHERE t.is_deleted=0`,
  bug: `/* period_analysis:records:bug */
    SELECT 'bug' business_type,b.id,b.title name,b.status,b.severity priority,
      COALESCE(project.product_id,requirement.product_id) product_id,product.name product_name,
      b.project_id,project.name project_name,b.requirement_id,requirement.title requirement_name,
      b.creator_id,b.updater_id,b.assignee_id owner_id,owner.real_name owner_name,ARRAY[b.assignee_id] owner_ids,
      ARRAY_REMOVE(ARRAY[b.assignee_id],NULL) business_role_ids,
      ARRAY_REMOVE(ARRAY[b.assignee_id,b.creator_id],NULL) person_ids,
      NULL::DATE plan_date,b.closed_date actual_date,b.resolved_date,b.created_at,0 is_overdue,FALSE is_paused,
      (b.status=2) is_completed,FALSE parent_project_paused,FALSE required_delivery,0 delivery_count
    FROM pms_bug b
    LEFT JOIN pms_project project ON project.id=b.project_id
    LEFT JOIN pms_requirement requirement ON requirement.id=b.requirement_id
    LEFT JOIN pms_product product ON product.id=COALESCE(project.product_id,requirement.product_id)
    LEFT JOIN pms_user owner ON owner.id=b.assignee_id
    WHERE b.is_deleted=0`,
  work_order: `/* period_analysis:records:work_order */
    SELECT 'work_order' business_type,w.id,w.problem_desc name,w.status,w.urgency priority,
      product.id product_id,product.name product_name,NULL::BIGINT project_id,NULL::TEXT project_name,
      NULL::BIGINT requirement_id,NULL::TEXT requirement_name,w.follower_id owner_id,
      w.creator_id,w.updater_id,owner.real_name owner_name,ARRAY[w.follower_id] owner_ids,
      ARRAY_REMOVE(ARRAY[w.follower_id],NULL) business_role_ids,
      ARRAY_REMOVE(ARRAY[w.follower_id,w.creator_id],NULL) person_ids,w.expected_resolve_date::DATE plan_date,
      w.resolve_date::DATE actual_date,w.suspend_date::DATE pause_date,w.created_at,${overdueSql('work_order', {alias:'w'}).fields},(w.status=4) is_paused,
      (w.status=2) is_completed,FALSE parent_project_paused,FALSE required_delivery,0 delivery_count
    FROM pms_work_order w
    JOIN pms_product product ON product.id=w.product_id
    LEFT JOIN pms_user owner ON owner.id=w.follower_id
    WHERE w.is_deleted=0`,
}

function argumentError(field, message) {
  const error = new Error(message)
  error.code = 'MCP_ARGUMENT_INVALID'
  error.fieldErrors = { [field]: message }
  return error
}

function parseDate(value, field = 'analysis_period') {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) throw argumentError(field, '日期必须使用 YYYY-MM-DD 格式')
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (date.getUTCFullYear() !== Number(match[1])
    || date.getUTCMonth() !== Number(match[2]) - 1
    || date.getUTCDate() !== Number(match[3])) {
    throw argumentError(field, `${value} 不是有效日期`)
  }
  return date
}

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date, days) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function daysInRange(start, end) {
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
}

function shiftWorkday(anchor, offset) {
  let date = new Date(anchor)
  if (offset === 0) {
    while ([0, 6].includes(date.getUTCDay())) date = addDays(date, -1)
    return date
  }
  const direction = offset > 0 ? 1 : -1
  let remaining = Math.abs(offset)
  while (remaining > 0) {
    date = addDays(date, direction)
    if (![0, 6].includes(date.getUTCDay())) remaining -= 1
  }
  return date
}

function shanghaiDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function resolvePeriod(period, now = new Date(), field = 'analysis_period') {
  if (!period || typeof period !== 'object' || Array.isArray(period)) {
    throw argumentError(field, '周期参数必须是对象')
  }
  const preset = period.preset
  if (!['day', 'workday', 'week', 'month', 'quarter', 'year', 'custom'].includes(preset)) {
    throw argumentError(field, '周期类型必须是 day、workday、week、month、quarter、year 或 custom')
  }
  if (preset === 'custom') {
    const start = parseDate(period.start_date, field)
    const end = parseDate(period.end_date, field)
    if (end < start) throw argumentError(field, '自定义周期结束日期不能早于开始日期')
    if (daysInRange(start, end) > MAX_PERIOD_DAYS) {
      throw argumentError(field, `自定义周期不能超过 ${MAX_PERIOD_DAYS} 天`)
    }
    return { preset, start_date: formatDate(start), end_date: formatDate(end) }
  }

  const anchor = parseDate(period.anchor_date || shanghaiDate(now), field)
  const offset = Number(period.offset || 0)
  if (!Number.isInteger(offset) || Math.abs(offset) > 1000) {
    throw argumentError(field, '周期偏移必须是 -1000 到 1000 之间的整数')
  }
  let start
  let end
  if (preset === 'day') {
    start = addDays(anchor, offset)
    end = start
  } else if (preset === 'workday') {
    start = shiftWorkday(anchor, offset)
    end = start
  } else if (preset === 'week') {
    const mondayOffset = anchor.getUTCDay() === 0 ? -6 : 1 - anchor.getUTCDay()
    start = addDays(anchor, mondayOffset + offset * 7)
    end = addDays(start, 6)
  } else if (preset === 'month') {
    start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + offset, 1))
    end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))
  } else if (preset === 'quarter') {
    const quarterStart = Math.floor(anchor.getUTCMonth() / 3) * 3 + offset * 3
    start = new Date(Date.UTC(anchor.getUTCFullYear(), quarterStart, 1))
    end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0))
  } else {
    start = new Date(Date.UTC(anchor.getUTCFullYear() + offset, 0, 1))
    end = new Date(Date.UTC(start.getUTCFullYear(), 11, 31))
  }
  return { preset, start_date: formatDate(start), end_date: formatDate(end) }
}

function dateInPeriod(value, period) {
  if (!value || !period) return false
  const date = dateOnly(value)
  return date >= period.start_date && date <= period.end_date
}

function parseBusinessTimestamp(value) {
  if (value instanceof Date) return value
  let text = String(value).trim().replace(' ', 'T')
    .replace(/([+-]\d{2})$/, '$1:00').replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  // PostgreSQL's timestamp-without-time-zone represents local business time,
  // not the machine running this query. SIDM's business timezone is Shanghai.
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) text += '+08:00'
  return new Date(text)
}

function dateOnly(value) {
  if (!value) return null
  const text = String(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : shanghaiDate(parseBusinessTimestamp(value))
}

function number(value) {
  const result = Number(value || 0)
  return Number.isFinite(result) ? result : 0
}

function normalizeRecord(row) {
  const ownerIds = Array.isArray(row.owner_ids) ? row.owner_ids.map(Number) : row.owner_id ? [Number(row.owner_id)] : []
  const businessRoleIds = [...new Set((Array.isArray(row.business_role_ids) ? row.business_role_ids : ownerIds)
    .map(Number).filter((id) => Number.isFinite(id) && id > 0))]
  const personIds = [...new Set((Array.isArray(row.person_ids) ? row.person_ids : ownerIds)
    .map(Number).filter(Number.isFinite))]
  const providedNames = Array.isArray(row.person_names) ? row.person_names : []
  const personNames = Object.fromEntries(personIds.map((id, index) => [
    id,
    providedNames[index] || (Number(row.owner_id) === id ? row.owner_name : null),
  ]))
  return {
    ...row,
    id: Number(row.id),
    status: Number(row.status),
    priority: row.priority === null || row.priority === undefined ? null : Number(row.priority),
    product_id: row.product_id === null || row.product_id === undefined ? null : Number(row.product_id),
    project_id: row.project_id === null || row.project_id === undefined ? null : Number(row.project_id),
    requirement_id: row.requirement_id === null || row.requirement_id === undefined ? null : Number(row.requirement_id),
    owner_id: row.owner_id === null || row.owner_id === undefined ? null : Number(row.owner_id),
    creator_id: row.creator_id === null || row.creator_id === undefined ? null : Number(row.creator_id),
    updater_id: row.updater_id === null || row.updater_id === undefined ? null : Number(row.updater_id),
    owner_ids: ownerIds,
    business_role_ids: businessRoleIds,
    person_ids: personIds,
    person_names: personNames,
    plan_date: dateOnly(row.plan_date),
    actual_date: dateOnly(row.actual_date),
    pause_date: dateOnly(row.pause_date),
    resolved_date: dateOnly(row.resolved_date),
    created_date: dateOnly(row.created_at),
    is_overdue: Number(row.is_overdue) === 1 || row.is_overdue === true,
    is_paused: row.is_paused === true || Number(row.is_paused) === 1,
    is_completed: row.is_completed === true || Number(row.is_completed) === 1,
    parent_project_paused: row.parent_project_paused === true || Number(row.parent_project_paused) === 1,
    required_delivery: row.required_delivery === true || Number(row.required_delivery) === 1,
    delivery_count: Number(row.delivery_count || 0),
  }
}

function authorizedTypes(args, context) {
  const allowedMenuPaths = context?.allowedMenuPaths instanceof Set ? context.allowedMenuPaths : new Set()
  const permitted = Object.keys(BUSINESS_TYPES).filter((type) => allowedMenuPaths.has(BUSINESS_TYPES[type].menu))
  const requested = Array.isArray(args.business_types) && args.business_types.length
    ? [...new Set(args.business_types)]
    : permitted
  return {
    requested,
    authorized: requested.filter((type) => permitted.includes(type)),
    excluded: requested.filter((type) => !permitted.includes(type)),
  }
}

function matchesFilters(record, filters = {}, cutoffDate) {
  const includes = (field, value) => !Array.isArray(filters[field]) || !filters[field].length
    || filters[field].map(Number).includes(Number(value))
  if (!includes('product_ids', record.product_id)) return false
  if (!includes('project_ids', record.project_id)) return false
  if (!includes('requirement_ids', record.requirement_id)) return false
  const relation = filters.person_relation || 'related'
  const people = record.person_relations
    ? Object.entries(record.person_relations).filter(([, relations]) => relation === 'related' || relations.includes(relation)).map(([id]) => Number(id))
    : record.person_ids
  if (Array.isArray(filters.person_ids) && filters.person_ids.length
    && !people.some((id) => filters.person_ids.map(Number).includes(Number(id)))) return false
  if (Array.isArray(filters.statuses) && filters.statuses.length
    && !filters.statuses.map(Number).includes(record.status)) return false
  if (Array.isArray(filters.priorities) && filters.priorities.length
    && !filters.priorities.map(Number).includes(record.priority)) return false
  if (filters.only_overdue === true && !currentOverdue(record, cutoffDate)) return false
  if (filters.only_paused === true && !record.is_paused) return false
  return true
}

function attachPersonRelations(records, logs, analysisPeriod) {
  const recordMap = new Map(records.map(record => [`${record.business_type}:${record.id}`, record]))
  const add = (record, id, relation) => {
    const value = Number(id)
    if (!Number.isInteger(value) || value < 1) return
    const relations = record.person_relations[value] ||= []
    if (!relations.includes(relation)) relations.push(relation)
  }
  for (const record of records) {
    record.person_relations = {}
    for (const id of record.business_role_ids) add(record, id, 'business_role')
    add(record, record.creator_id, 'creator')
    add(record, record.updater_id, 'updater')
  }
  for (const log of logs) {
    const record = recordMap.get(`${log.business_type}:${Number(log.target_id)}`)
    if (record && dateInPeriod(dateOnly(log.created_at), analysisPeriod)) add(record, log.operator_id, 'operator')
  }
}

async function loadRecords(types, filters, database, cutoffDate, resolveNames = true) {
  const results = await Promise.all(types.map(async (type) => {
    const rows = await database.prepare(RECORD_QUERIES[type]).all()
    return rows.map(normalizeRecord)
  }))
  const records = results.flat()
  const missingPersonIds = [...new Set(records.flatMap((record) => record.person_ids
    .filter((id) => !record.person_names[id])))]
  if (resolveNames && missingPersonIds.length) {
    const people = await database.prepare(`/* period_analysis:people */
      SELECT id,real_name name FROM pms_user WHERE id IN (${missingPersonIds.map(() => '?').join(',')})`).all(...missingPersonIds)
    const names = new Map(people.map((person) => [Number(person.id), person.name]))
    for (const record of records) {
      for (const id of record.person_ids) record.person_names[id] ||= names.get(id) || `用户ID ${id}`
    }
  }
  return records.filter((record) => matchesFilters(record, filters, cutoffDate))
}

async function loadLogs(types, records, database, identityPeriod = null) {
  if (!types.length || !records.length) return []
  const moduleCases = types.map((type) => `WHEN '${BUSINESS_TYPES[type].module}' THEN '${type}'`).join(' ')
  const params = []
  const scopes = types.map((type) => {
    params.push(BUSINESS_TYPES[type].module, records.filter((record) => record.business_type === type).map((record) => record.id))
    // Stage containers and stage items have independent IDs in the same log module.
    const itemOnly = type === 'stage_plan'
      ? " AND action NOT IN ('新增阶段','编辑阶段','调整阶段顺序','删除阶段','套用阶段模板')" : ''
    return `(module=? AND target_id=ANY(?::BIGINT[])${itemOnly})`
  })
  // One target-scoped history read: an event may be backfilled after the report
  // period, and subsequent reopen/pause entries are needed for as-of reasoning.
  if (identityPeriod) params.push(`${identityPeriod.start_date}T00:00:00+08:00`,
    `${formatDate(addDays(parseDate(identityPeriod.end_date), 1))}T00:00:00+08:00`)
  const sql = `/* period_analysis:logs */
    SELECT id log_id,CASE module ${moduleCases} END business_type,target_id,operation_id,user_id operator_id,action,
      ${identityPeriod ? '' : 'field_name,old_value,new_value,'}created_at
    FROM pms_op_log
    WHERE (${scopes.join(' OR ')})${identityPeriod ? ' AND created_at>=?::timestamptz AND created_at<?::timestamptz' : ''}
    ORDER BY created_at,id`
  return database.prepare(sql).all(...params)
}

async function buildBusinessRelatedPeople(records, logs, analysisPeriod, database) {
  const people = new Map()
  const recordsByKey = new Map(records.map((record) => [`${record.business_type}:${record.id}`, record]))
  const sourceOrder = ['business_role', 'creator', 'updater', 'operator']
  const addPerson = (userId, source, recordKey, operationKey = null) => {
    const id = Number(userId)
    if (!Number.isFinite(id) || id <= 0) return
    if (!people.has(id)) people.set(id, { sources: new Set(), records: new Set(), operations: new Set() })
    const person = people.get(id)
    person.sources.add(source)
    if (recordKey) person.records.add(recordKey)
    if (operationKey) person.operations.add(operationKey)
  }

  for (const record of records) {
    const recordKey = `${record.business_type}:${record.id}`
    for (const userId of record.business_role_ids) addPerson(userId, 'business_role', recordKey)
    addPerson(record.creator_id, 'creator', recordKey)
    addPerson(record.updater_id, 'updater', recordKey)
  }
  for (const log of logs) {
    if (!dateInPeriod(dateOnly(log.created_at), analysisPeriod)) continue
    const recordKey = `${log.business_type}:${Number(log.target_id)}`
    if (!recordsByKey.has(recordKey)) continue
    const operationKey = log.operation_id
      || `${recordKey}:log:${log.log_id || `${log.operator_id}:${log.created_at}:${log.field_name || ''}`}`
    addPerson(log.operator_id, 'operator', recordKey, operationKey)
  }

  const userIds = [...people.keys()]
  if (!userIds.length) return []
  const rows = await database.prepare(`/* period_analysis:report_people */
    SELECT id,real_name name,status,is_deleted
    FROM pms_user
    WHERE id IN (${userIds.map(() => '?').join(',')}) AND status=1 AND is_deleted=0`).all(...userIds)
  return rows
    .filter((row) => Number(row.status ?? 1) === 1 && Number(row.is_deleted ?? 0) === 0)
    .map((row) => {
      const userId = Number(row.id)
      const person = people.get(userId)
      return {
        user_id: userId,
        name: row.name || `用户ID ${userId}`,
        sources: sourceOrder.filter((source) => person.sources.has(source)),
        related_record_count: person.records.size,
        period_operation_count: person.operations.size,
      }
    })
    .sort((left, right) => left.user_id - right.user_id)
}

function emptyFlow() {
  return {
    created: 0,
    completed: 0,
    important_adjustments: 0,
    became_overdue: 0,
    new_overdue_unresolved: 0,
    paused: 0,
    resumed: 0,
    fixed: 0,
    activated: 0,
    reopened: 0,
  }
}

function isCompletedStatus(type, status) {
  return BUSINESS_TYPES[type]?.completed.includes(Number(status)) || false
}

function isPausedStatus(type, status) {
  return BUSINESS_TYPES[type]?.paused.includes(Number(status)) || false
}

function statusEvent(type, oldStatus, newStatus) {
  const oldValue = Number(oldStatus)
  const newValue = Number(newStatus)
  if (isCompletedStatus(type, newValue) && !isCompletedStatus(type, oldValue)) return 'completed'
  if (isPausedStatus(type, newValue) && !isPausedStatus(type, oldValue)) return 'paused'
  if (isPausedStatus(type, oldValue) && !isPausedStatus(type, newValue)) return 'resumed'
  if (type === 'bug' && newValue === 1 && oldValue !== 1) return 'fixed'
  if (type === 'bug' && newValue === 3 && oldValue !== 3) return 'activated'
  if (type === 'work_order' && newValue === 5 && oldValue !== 5) return 'activated'
  if (isCompletedStatus(type, oldValue) && !isCompletedStatus(type, newValue)) return 'reopened'
  return null
}

function historyKey(type, id) {
  return `${type}:${Number(id)}`
}

function operationKey(log) {
  return `${historyKey(log.business_type, log.target_id)}:${log.operation_id || `legacy:${log.created_at}:${log.operator_id || ''}`}`
}

function statusDateField(type, status) {
  if (isPausedStatus(type, status)) return type === 'requirement' ? 'pause_date' : type === 'stage_plan' ? null : 'suspend_date'
  if (type === 'bug' && Number(status) === 1) return 'resolved_date'
  if (isCompletedStatus(type, status)) return type === 'bug' ? 'closed_date' : type === 'work_order' ? 'resolve_date' : 'actual_end_date'
  return null
}

function buildHistories(records, logs) {
  const histories = new Map(records.map((record) => [historyKey(record.business_type, record.id), {
    record, transitions: [], fields: [], inconsistent: false,
  }]))
  const operations = new Map()
  const orderedLogs = [...logs].sort((a, b) => parseBusinessTimestamp(a.created_at) - parseBusinessTimestamp(b.created_at)
    || number(a.log_id) - number(b.log_id))
  for (const log of orderedLogs) {
    const key = operationKey(log)
    if (!operations.has(key)) operations.set(key, new Map())
    operations.get(key).set(log.field_name, log)
  }
  for (const log of orderedLogs) {
    const history = histories.get(historyKey(log.business_type, log.target_id))
    if (!history || String(log.old_value ?? '') === String(log.new_value ?? '')) continue
    history.fields.push(log)
    if (log.field_name !== 'status') continue
    const field = statusDateField(log.business_type, log.new_value)
    const actualDate = field ? dateOnly(operations.get(operationKey(log))?.get(field)?.new_value) : null
    const previous = history.transitions.at(-1)
    if (previous && previous.status !== Number(log.old_value)) history.inconsistent = true
    history.transitions.push({
      status: Number(log.new_value), previous_status: Number(log.old_value),
      date: actualDate || dateOnly(log.created_at), actual_date: actualDate,
      date_source: actualDate ? 'operation_business_date' : 'recorded_at_fallback', log,
    })
  }
  for (const history of histories.values()) {
    const { record, transitions } = history
    const last = transitions.at(-1)
    // A current business date is evidence for the last matching transition only;
    // a retained date on a reopened record must not become a new completion.
    if (last && last.status === record.status && !last.actual_date) {
      const currentDate = isCompletedStatus(record.business_type, last.status) ? record.actual_date
        : isPausedStatus(record.business_type, last.status) ? record.pause_date
          : record.business_type === 'bug' && last.status === 1 ? record.resolved_date : null
      if (currentDate) Object.assign(last, { date: currentDate, actual_date: currentDate, date_source: 'current_business_date' })
    }
    if (last && last.status !== record.status) history.inconsistent = true
  }
  return histories
}

function completionStateAt(record, cutoff, history, today) {
  const transitions = history?.transitions || []
  const ordered = [...transitions].sort((a, b) => a.date.localeCompare(b.date)
    || parseBusinessTimestamp(a.log.created_at) - parseBusinessTimestamp(b.log.created_at) || number(a.log.log_id) - number(b.log.log_id))
  const atCutoff = ordered.filter((event) => event.date <= cutoff)
  const latest = atCutoff.at(-1)
  let status = latest?.status ?? ordered[0]?.previous_status ?? record.status
  if (cutoff === today) status = record.status
  if (history?.inconsistent && cutoff < today) return { completed: false, date: null, unknown: true }
  const complete = isCompletedStatus(record.business_type, status)
  if (!complete) {
    // Absence of a retained completion date is not evidence that an old item
    // was unfinished at a historical cutoff (completion may have been cleared).
    // Today's status, or a record not created yet at the cutoff, is direct evidence.
    const unknown = cutoff < today && !transitions.length
      && (!record.created_date || record.created_date <= cutoff)
    return { completed: false, date: null, unknown }
  }
  const completion = [...atCutoff].reverse().find((event) => isCompletedStatus(record.business_type, event.status))
  const date = completion?.actual_date || completion?.date || (record.is_completed ? record.actual_date : null)
  return { completed: Boolean(date && date <= cutoff), date, unknown: !date }
}

function historicalOverdueDates(record, history, cutoffDate) {
  if (!record.plan_date || record.business_type === 'bug') return []
  if (record.business_type === 'stage_plan' && record.parent_project_paused) return []
  const dueEntered = formatDate(addDays(parseDate(record.plan_date), 1))
  const entered = record.created_date && record.created_date > dueEntered ? record.created_date : dueEntered
  if (entered > cutoffDate || history?.inconsistent) return []
  let transitions = [...(history?.transitions || [])]
  if (!transitions.length) {
    const date = record.is_completed ? record.actual_date : record.is_paused ? record.pause_date : null
    if (date) transitions = [{ date, status: record.status, previous_status: null }]
    else if (record.is_completed || record.is_paused
      || (record.business_type === 'requirement' && calculateRequirementOverdue(record.plan_date, record.status, cutoffDate) === null)) return []
  }
  transitions.sort((a, b) => a.date.localeCompare(b.date)
    || number(a.log?.log_id) - number(b.log?.log_id))
  const eligible = (status) => !isCompletedStatus(record.business_type, status) && !isPausedStatus(record.business_type, status)
    && (record.business_type !== 'requirement' || calculateRequirementOverdue(record.plan_date, status, cutoffDate) !== null)
  let status = transitions[0]?.previous_status ?? (transitions.length ? null : record.status)
  // A completion/pause dated the day after the deadline does not undo that
  // day's entry into overdue. Only a prior-day terminal state prevents entry.
  for (const transition of transitions.filter((event) => event.date < entered)) status = transition.status
  const dates = eligible(status) ? [entered] : []
  for (const transition of transitions) {
    if (transition.date < entered || transition.date > cutoffDate) continue
    if (!eligible(status) && eligible(transition.status)) dates.push(transition.date)
    status = transition.status
  }
  return dates
}

function createEvents(records, logs, cutoffDate, eventTimeBasis = 'actual', histories = buildHistories(records, logs), createdOnly = false) {
  const recordMap = new Map(records.map((record) => [`${record.business_type}:${record.id}`, record]))
  const transitionsByLog = new Map([...histories.values()].flatMap((history) => history.transitions.map((event) => [event.log, event])))
  const events = []
  for (const record of records) {
    if (record.created_date) events.push({ type: 'created', date: record.created_date, actual_date: record.created_date,
      recorded_at: record.created_at, date_source: 'created_at', record })
  }
  if (createdOnly) return events

  const dedupe = new Set()
  const operationFields = new Map()
  const importantFields = new Set([
    'owner_id', 'owner_ids', 'member_ids', 'assignee_id', 'follower_id', 'collaborator_ids',
    'expected_end_date', 'expected_resolve_date', 'current_due_date', 'priority', 'severity', 'urgency',
  ])
  const isImportantChange = log => importantFields.has(log.field_name)
    || (log.field_name === 'status' && ['paused', 'resumed'].includes(statusEvent(log.business_type, log.old_value, log.new_value)))
  const eventDate = log => eventTimeBasis === 'actual'
    ? transitionsByLog.get(log)?.date || dateOnly(log.created_at) : dateOnly(log.created_at)
  for (const log of logs) {
    const key = operationKey(log)
    if (!operationFields.has(key)) operationFields.set(key, new Map())
    operationFields.get(key).set(log.field_name, log)
  }
  for (const log of logs) {
    const record = recordMap.get(`${log.business_type}:${Number(log.target_id)}`)
    if (!record || String(log.old_value ?? '') === String(log.new_value ?? '')) continue
    const recordedDate = dateOnly(log.created_at)
    const transition = transitionsByLog.get(log)
    const date = eventTimeBasis === 'actual' ? transition?.date || recordedDate : recordedDate
    if (log.field_name === 'status') {
      const eventType = statusEvent(record.business_type, log.old_value, log.new_value)
      if (eventType) {
        const key = `${eventType}:${record.business_type}:${record.id}:${date}`
        if (!dedupe.has(key)) {
          dedupe.add(key)
          events.push({ type: eventType, date, actual_date: transition?.actual_date || null,
            recorded_at: log.created_at, date_source: transition?.date_source || 'recorded_at_fallback', record, log })
        }
      }
    }
    if (isImportantChange(log)) {
      // One operation may backfill a pause date and change today's plan.
      // Keep their distinct event dates, while grouping all same-day changes.
      const key = `important_adjustments:${record.business_type}:${record.id}:${log.operation_id || log.field_name}:${date}`
      if (!dedupe.has(key)) {
        dedupe.add(key)
        const changes = log.operation_id
          ? [...(operationFields.get(operationKey(log))?.values() || [])]
            .filter(item => isImportantChange(item) && eventDate(item) === date
              && String(item.old_value ?? '') !== String(item.new_value ?? ''))
            .sort((a, b) => String(a.field_name).localeCompare(String(b.field_name)))
          : [log]
        const source = changes.find(item => item.field_name === 'status') || changes[0]
        const sourceTransition = transitionsByLog.get(source)
        events.push({ type: 'important_adjustments', date, actual_date: sourceTransition?.actual_date || null,
          recorded_at: source.created_at, date_source: sourceTransition?.date_source || 'recorded_at_fallback', record, log: source, changes })
      }
    }
  }
  const recordedEventKeys = new Set(events.map((event) => `${event.type}:${historyKey(event.record.business_type, event.record.id)}`))
  for (const record of records) {
    const history = histories.get(historyKey(record.business_type, record.id))
    if (eventTimeBasis === 'actual' && !history?.inconsistent) {
      const businessDates = [
        ['completed', isCompletedStatus(record.business_type, record.status) ? record.actual_date : null],
        ['fixed', record.business_type === 'bug' && [1, 2].includes(record.status) ? record.resolved_date : null],
        ['paused', isPausedStatus(record.business_type, record.status) ? record.pause_date : null],
      ]
      for (const [type, date] of businessDates) {
        if (!date || date > cutoffDate || recordedEventKeys.has(`${type}:${historyKey(record.business_type, record.id)}`)) continue
        // Retained dates cannot prove a new completion/fix after a recorded
        // reopening. Existing complete event histories always take precedence.
        const superseded = history?.transitions.some((transition) => transition.date > date
          && ['activated', 'reopened'].includes(statusEvent(record.business_type, transition.previous_status, transition.status)))
        if (superseded) continue
        events.push({ type, date, actual_date: date, recorded_at: null,
          date_source: 'current_business_date_without_status_log', record })
      }
    }
    for (const enteredOverdue of historicalOverdueDates(record, histories.get(historyKey(record.business_type, record.id)), cutoffDate)) {
      events.push({ type: 'became_overdue', date: enteredOverdue, actual_date: enteredOverdue,
        recorded_at: null, date_source: 'derived_current_plan_and_status_history', record })
      if (!record.is_completed && currentOverdue(record, cutoffDate)) {
        events.push({ type: 'new_overdue_unresolved', date: enteredOverdue, actual_date: enteredOverdue,
          recorded_at: null, date_source: 'derived_current_plan_and_status_history', record })
      }
    }
  }
  return events
}

function summarizeFlow(types, events, period) {
  const byBusinessType = Object.fromEntries(types.map((type) => [type, emptyFlow()]))
  const total = emptyFlow()
  for (const event of uniquePeriodEvents(events, period)) {
    if (!byBusinessType[event.record.business_type]) continue
    byBusinessType[event.record.business_type][event.type] += 1
    total[event.type] += 1
  }
  return { by_business_type: byBusinessType, total }
}

function uniquePeriodEvents(events, period) {
  const seen = new Set()
  return events.filter((event) => {
    if (!dateInPeriod(event.date, period)) return false
    const key = `${event.type}:${event.record.business_type}:${event.record.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function currentOverdue(record, cutoffDate) {
  if (record.business_type === 'bug') return false
  return calculateOverdue(record.business_type, {
    date: record.plan_date, status: record.status,
    parentStatus: record.parent_project_paused ? 3 : undefined,
  }, cutoffDate).isOverdue === 1
}

function isRejectedRequirement(record) {
  return record.business_type === 'requirement' && [3, 13, 22].includes(record.status)
}

function isTransferredRequirement(record) { return record.business_type === 'requirement' && Number(record.status) === 36 }

function isUnfinished(record) {
  return !record.is_completed && !isRejectedRequirement(record) && !isTransferredRequirement(record)
}

function summarizeStock(types, records, cutoffDate) {
  const summarize = (items) => ({
    total: items.length,
    unfinished: items.filter(isUnfinished).length,
    in_progress: items.filter((record) => BUSINESS_TYPES[record.business_type].inProgress.includes(record.status)).length,
    paused: items.filter((record) => record.is_paused).length,
    overdue: items.filter((record) => currentOverdue(record, cutoffDate)).length,
  })
  return {
    by_business_type: Object.fromEntries(types.map((type) => [type, summarize(records.filter((record) => record.business_type === type))])),
    total: summarize(records),
  }
}

function selectPlanRecords(records, planPeriod, completionCutoff, logs = [], cutoffDate = completionCutoff, histories = buildHistories(records, logs)) {
  const selected = { planned: [], completed: [], pending: [], unknown: [] }
  if (!planPeriod) return selected
  for (const record of records) {
    if (isRejectedRequirement(record) || isTransferredRequirement(record) || record.is_paused || record.parent_project_paused || !dateInPeriod(record.plan_date, planPeriod)) continue
    const state = completionStateAt(record, completionCutoff, histories.get(historyKey(record.business_type, record.id)), cutoffDate)
    if (state.completed && state.date < planPeriod.start_date) continue
    selected.planned.push(record)
    selected[state.completed ? 'completed' : 'pending'].push(record)
    if (state.unknown) selected.unknown.push(record)
  }
  return selected
}

function summarizePlan(types, records, planPeriod, completionCutoff, logs = [], cutoffDate = completionCutoff, histories = buildHistories(records, logs)) {
  if (!planPeriod) return null
  const summarize = (items) => {
    const selected = selectPlanRecords(items, planPeriod, completionCutoff, logs, cutoffDate, histories)
    return { planned: selected.planned.length, completed: selected.completed.length, pending: selected.pending.length }
  }
  return {
    by_business_type: Object.fromEntries(types.map((type) => [type, summarize(records.filter((record) => record.business_type === type))])),
    total: summarize(records),
  }
}

function flowComparison(current, comparison) {
  const metrics = {}
  for (const key of Object.keys(current.total)) {
    const currentValue = current.total[key]
    const comparisonValue = comparison.total[key]
    metrics[key] = {
      current: currentValue,
      comparison: comparisonValue,
      absolute_change: currentValue - comparisonValue,
      ...(comparisonValue !== 0 ? { change_ratio: (currentValue - comparisonValue) / comparisonValue } : {}),
    }
  }
  return { metrics }
}

function selectFlowMetrics(flow, metrics) {
  if (!Array.isArray(metrics) || !metrics.length) return flow
  return Object.fromEntries(metrics.map((metric) => [metric, number(flow[metric])]))
}

function applyMetricSelection(result, metrics) {
  if (!Array.isArray(metrics) || !metrics.length) return result
  if (result.period_flows) {
    result.period_flows.total = selectFlowMetrics(result.period_flows.total, metrics)
    for (const type of Object.keys(result.period_flows.by_business_type)) {
      result.period_flows.by_business_type[type] = selectFlowMetrics(result.period_flows.by_business_type[type], metrics)
    }
  }
  if (result.comparison) {
    result.comparison.metrics = Object.fromEntries(metrics.map((metric) => [metric, result.comparison.metrics[metric]]))
  }
  for (const bucket of result.trend?.buckets || []) {
    bucket.period_flows = selectFlowMetrics(bucket.period_flows, metrics)
  }
  for (const groups of Object.values(result.groupings || {})) {
    for (const group of groups) group.period_flows = selectFlowMetrics(group.period_flows, metrics)
  }
  return result
}

function bucketKey(date, granularity) {
  const parsed = parseDate(date)
  if (granularity === 'day') return date
  if (granularity === 'week') {
    const offset = parsed.getUTCDay() === 0 ? -6 : 1 - parsed.getUTCDay()
    return formatDate(addDays(parsed, offset))
  }
  if (granularity === 'month') return `${date.slice(0, 7)}-01`
  if (granularity === 'quarter') {
    const month = Math.floor(parsed.getUTCMonth() / 3) * 3
    return formatDate(new Date(Date.UTC(parsed.getUTCFullYear(), month, 1)))
  }
  return `${date.slice(0, 4)}-01-01`
}

function bucketEnd(start, granularity) {
  const date = parseDate(start)
  if (granularity === 'day') return start
  if (granularity === 'week') return formatDate(addDays(date, 6))
  if (granularity === 'month') return formatDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)))
  if (granularity === 'quarter') return formatDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 3, 0)))
  return `${date.getUTCFullYear()}-12-31`
}

function buildTrend(events, period, granularity) {
  if (!granularity) return null
  const buckets = new Map()
  for (let date = parseDate(period.start_date); date <= parseDate(period.end_date); date = addDays(date, 1)) {
    const current = formatDate(date)
    const key = bucketKey(current, granularity)
    if (!buckets.has(key)) buckets.set(key, emptyFlow())
  }
  const seen = new Set()
  for (const event of events) {
    if (!dateInPeriod(event.date, period)) continue
    const key = bucketKey(event.date, granularity)
    const eventKey = `${key}:${event.type}:${event.record.business_type}:${event.record.id}`
    if (seen.has(eventKey)) continue
    seen.add(eventKey)
    if (buckets.has(key)) buckets.get(key)[event.type] += 1
  }
  return {
    granularity,
    buckets: [...buckets.entries()].map(([start, periodFlows]) => ({
      start_date: start < period.start_date ? period.start_date : start,
      end_date: bucketEnd(start, granularity) > period.end_date ? period.end_date : bucketEnd(start, granularity),
      period_flows: periodFlows,
    })),
  }
}

function groupValue(record, dimension) {
  const mapping = {
    business_type: [record.business_type, BUSINESS_TYPES[record.business_type].label],
    product: [record.product_id, record.product_name],
    project: [record.project_id, record.project_name],
    requirement: [record.requirement_id, record.requirement_name],
    status: [`${record.business_type}:${record.status}`, String(record.status)],
    priority: [`${record.business_type}:${record.priority}`, record.priority === null ? null : String(record.priority)],
    plan_date: [record.plan_date, record.plan_date],
  }
  return mapping[dimension] || [null, null]
}

function buildGroupings(dimensions, records, events, analysisPeriod, planPeriod, cutoffDate, completionCutoff, logs, histories) {
  const result = {}
  for (const dimension of dimensions || []) {
    const groups = new Map()
    for (const record of records) {
      const values = dimension === 'person'
        ? (record.person_ids.length
            ? record.person_ids.map((id) => [id, record.person_names[id]])
            : [[null, null]])
        : [groupValue(record, dimension)]
      for (const [key, label] of values) {
        const mapKey = key === null || key === undefined ? '__none__' : String(key)
        if (!groups.has(mapKey)) groups.set(mapKey, { key, label: label || '未设置', records: [] })
        groups.get(mapKey).records.push(record)
      }
    }
    result[dimension] = [...groups.values()].sort((a, b) => String(a.key).localeCompare(String(b.key))).map((group) => {
      const ids = new Set(group.records.map((record) => `${record.business_type}:${record.id}`))
      const groupEvents = events.filter((event) => ids.has(`${event.record.business_type}:${event.record.id}`))
      return {
        key: group.key,
        label: group.label,
        period_flows: summarizeFlow([...new Set(group.records.map((record) => record.business_type))], groupEvents, analysisPeriod).total,
        current_stock: summarizeStock([...new Set(group.records.map((record) => record.business_type))], group.records, cutoffDate).total,
        plan_outlook: summarizePlan([...new Set(group.records.map((record) => record.business_type))], group.records,
          planPeriod, completionCutoff, logs, cutoffDate, histories)?.total || null,
      }
    })
  }
  return result
}

function candidate(record, cutoffDate) {
  const name = summarizeRichText(record.name)
  const overdue = currentOverdue(record, cutoffDate)
  return {
    business_type: record.business_type,
    business_type_label: BUSINESS_TYPES[record.business_type].label,
    target_id: record.id,
    name: name.length > 300 ? `${name.slice(0, 300)}…` : name,
    name_truncated: name.length > 300,
    product_id: record.product_id ?? null,
    project_id: record.project_id ?? null,
    requirement_id: record.requirement_id ?? null,
    parent_task_id: record.parent_task_id ? Number(record.parent_task_id) : null,
    detail_target_id: record.business_type === 'stage_plan' ? record.project_id : record.id,
    project_name: record.project_name || null,
    owner_name: record.owner_name || null,
    owner_ids: record.owner_ids,
    creator_id: record.creator_id,
    updater_id: record.updater_id,
    people: Object.entries(record.person_relations || {}).map(([id, relations]) => ({
      user_id: Number(id), name: record.person_names[id] || `用户ID ${id}`, relations,
    })),
    status: record.status,
    priority: record.priority,
    plan_date: record.plan_date,
    is_overdue: overdue,
    overdue_days: overdue ? calculateOverdue(record.business_type, { date: record.plan_date, status: record.status }, cutoffDate).overdueDays : 0,
  }
}

// These are inputs to the actual candidate display, not a copy of database rows.
// Keep raw text raw here: sanitizing rich text belongs after the page slice.
function candidateTokenFields(record, cutoffDate) {
  return [record.business_type, record.id, record.name,
    record.product_id, record.project_id, record.requirement_id, number(record.parent_task_id) || null,
    record.project_name || null, record.owner_name || null, record.owner_ids,
    record.creator_id, record.updater_id, record.status, record.priority, record.plan_date,
    currentOverdue(record, cutoffDate), Object.entries(record.person_relations || {})
      .map(([id, relations]) => [id, record.person_names[id] || `用户ID ${id}`, relations])]
}

function flowTokenFields(group, cutoffDate) {
  const event = group.latest
  const changes = []
  const operators = new Set()
  let changeCount = 0
  for (const item of group.events) {
    const operator = Number(item.log?.operator_id)
    if (Number.isInteger(operator) && operator > 0) operators.add(operator)
    for (const change of item.changes || (item.log ? [item.log] : [])) {
      changeCount++
      if (changes.length < 50) changes.push([dateOnly(change.created_at) || event.date,
        number(change.operator_id) || null, change.field_name, change.old_value ?? null, change.new_value ?? null])
    }
  }
  return [candidateTokenFields(event.record, cutoffDate), event.date,
    event.actual_date || (['created', 'became_overdue', 'new_overdue_unresolved'].includes(event.type) ? event.date : null),
    dateOnly(event.recorded_at || event.log?.created_at || (event.type === 'created' ? event.record.created_at : null)),
    event.date_source || (event.type === 'created' ? 'created_at' : 'derived'), [...operators], changeCount, changes]
}

function flowCandidate(group, cutoffDate) {
  const event = group.latest
  const rawChanges = group.events.flatMap((item) => item.changes || (item.log ? [item.log] : []))
  const changes = rawChanges.slice(0, 50).map((change) => {
    const oldValue = change.old_value == null ? null : summarizeRichText(change.old_value)
    const newValue = change.new_value == null ? null : summarizeRichText(change.new_value)
    return {
      event_date: dateOnly(change.created_at) || event.date,
      operator_id: change.operator_id ? Number(change.operator_id) : null,
      field_name: change.field_name,
      old_value: oldValue?.slice(0, 500) ?? null,
      new_value: newValue?.slice(0, 500) ?? null,
      value_truncated: [oldValue, newValue].some(value => value != null && value.length > 500),
    }
  })
  return {
    ...candidate(event.record, cutoffDate),
    event_date: event.date,
    actual_date: event.actual_date || (['created', 'became_overdue', 'new_overdue_unresolved'].includes(event.type) ? event.date : null),
    recorded_date: dateOnly(event.recorded_at || event.log?.created_at || (event.type === 'created' ? event.record.created_at : null)),
    date_source: event.date_source || (event.type === 'created' ? 'created_at' : 'derived'),
    operator_ids: [...new Set(group.events.map(item => Number(item.log?.operator_id)).filter(id => Number.isInteger(id) && id > 0))],
    changes,
    changes_total: rawChanges.length,
    changes_truncated: rawChanges.length > 50 || changes.some(change => change.value_truncated),
  }
}

function selectFlowGroups(events, period, metric) {
  const groups = new Map()
  for (const event of events) {
    if (event.type !== metric || !dateInPeriod(event.date, period)) continue
    const key = `${event.record.business_type}:${event.record.id}`
    if (!groups.has(key)) groups.set(key, { events: [], latest: event })
    const group = groups.get(key)
    group.events.push(event)
    if (event.date > group.latest.date) group.latest = event
  }
  return [...groups.values()].sort((a, b) => String(b.latest.date).localeCompare(String(a.latest.date))
    || number(b.latest.record.priority) - number(a.latest.record.priority)
    || a.latest.record.business_type.localeCompare(b.latest.record.business_type)
    || a.latest.record.id - b.latest.record.id)
}

function buildFlowCandidates(events, period, metrics, limit, cutoffDate) {
  const selected = Array.isArray(metrics) && metrics.length ? metrics : Object.keys(emptyFlow())
  return Object.fromEntries(selected.map((type) => {
    const items = selectFlowGroups(events, period, type)
    return [type, {
      items: items.slice(0, limit).map(group => flowCandidate(group, cutoffDate)),
      total: items.length,
      has_more: items.length > limit,
    }]
  }))
}

function selectRiskItems(records, cutoffDate, riskPeriod, metric) {
  const period = riskPeriod || {
    start_date: cutoffDate,
    end_date: formatDate(addDays(parseDate(cutoffDate), 7)),
  }
  if (metric === 'workload_concentration') {
    const ownerCounts = new Map()
    for (const record of records.filter(record => currentOverdue(record, cutoffDate))) {
      for (const id of new Set(record.owner_ids)) {
        const item = ownerCounts.get(id) || {
          owner_id: id, owner_name: record.person_names[id] || `用户ID ${id}`, overdue_count: 0,
        }
        item.overdue_count += 1
        ownerCounts.set(id, item)
      }
    }
    return [...ownerCounts.values()].filter(item => item.overdue_count >= 2)
      .sort((a, b) => b.overdue_count - a.overdue_count || a.owner_id - b.owner_id)
  }
  const selectors = {
    overdue: record => currentOverdue(record, cutoffDate),
    due_soon: record => !isTransferredRequirement(record) && !record.is_completed && !record.is_paused && !record.parent_project_paused
      && !isRejectedRequirement(record)
      && dateInPeriod(record.plan_date, period),
    paused: record => record.is_paused,
    missing_delivery: record => record.business_type === 'stage_plan'
      && record.required_delivery && record.delivery_count === 0 && !record.parent_project_paused,
    missing_plan_date: record => !isTransferredRequirement(record) && !record.plan_date && record.business_type !== 'bug',
  }
  return records.filter(selectors[metric]).sort((a, b) => number(b.priority) - number(a.priority)
    || String(a.plan_date || '9999-12-31').localeCompare(String(b.plan_date || '9999-12-31'))
    || a.business_type.localeCompare(b.business_type) || a.id - b.id)
}

function buildRisks(records, cutoffDate, riskPeriod, limit) {
  return Object.fromEntries(['overdue', 'due_soon', 'paused', 'missing_delivery', 'missing_plan_date', 'workload_concentration']
    .map(metric => {
      const items = selectRiskItems(records, cutoffDate, riskPeriod, metric)
      return [metric, {
        items: items.slice(0, limit).map(item => metric === 'workload_concentration' ? item : candidate(item, cutoffDate)),
        total: items.length, has_more: items.length > limit,
      }]
    }))
}

function qualitySummary(records, events, period) {
  const periodEvents = uniquePeriodEvents(events, period)
  const completed = periodEvents.filter((event) => event.type === 'completed')
  const onTime = completed.filter((event) => event.record.plan_date
    && (event.actual_date || event.date) <= event.record.plan_date).length
  const delayed = completed.filter((event) => event.record.plan_date
    && (event.actual_date || event.date) > event.record.plan_date).length
  const scheduleAdjustments = uniquePeriodEvents(events.filter(event => event.type === 'important_adjustments'
    && (event.changes || [event.log]).some(change =>
      ['expected_end_date', 'expected_resolve_date', 'current_due_date'].includes(change?.field_name))), period).length
  const stageItems = records.filter((record) => record.business_type === 'stage_plan' && record.required_delivery)
  return {
    on_time_completed: onTime,
    delayed_completed: delayed,
    schedule_adjustments: scheduleAdjustments,
    stage_delivery_required: stageItems.length,
    stage_delivery_missing: stageItems.filter((record) => record.delivery_count === 0).length,
    bug_fixed: periodEvents.filter((event) => event.type === 'fixed').length,
    bug_closed: completed.filter(({ record }) => record.business_type === 'bug').length,
    bug_activated: periodEvents.filter((event) => event.type === 'activated' && event.record.business_type === 'bug').length,
    work_order_resolved: completed.filter(({ record }) => record.business_type === 'work_order').length,
    work_order_activated: periodEvents.filter((event) => event.type === 'activated' && event.record.business_type === 'work_order').length,
  }
}

async function loadFinancials(analysisPeriod, planPeriod, database, projectIds) {
  const plan = planPeriod || analysisPeriod
  const sql = `/* period_analysis:financials */
    WITH scoped_contracts AS (
      SELECT contract.id,contract.contract_amount,contract.signed_date
      FROM pms_project_contract contract
      JOIN pms_project project ON project.id=contract.project_id AND project.is_deleted=0
      WHERE contract.is_deleted=0 AND project.id=ANY(?::BIGINT[])
    ), scoped_stages AS (
      SELECT stage.id,stage.planned_amount
      FROM pms_project_payment_stage stage
      JOIN scoped_contracts contract ON contract.id=stage.contract_id
      WHERE stage.is_deleted=0
    ), scoped_payments AS (
      SELECT payment.payment_amount,payment.created_at,payment.payment_month
      FROM pms_project_payment_record payment
      JOIN scoped_stages stage ON stage.id=payment.stage_id
      WHERE payment.is_deleted=0
    )
    SELECT
      COUNT(DISTINCT contract.id)::INTEGER contract_count,
      COALESCE(SUM(contract.contract_amount),0)::NUMERIC contract_amount,
      COALESCE((SELECT SUM(stage.planned_amount) FROM scoped_stages stage),0)::NUMERIC planned_payment_amount,
      COALESCE((SELECT SUM(payment.payment_amount) FROM scoped_payments payment),0)::NUMERIC actual_payment_amount,
      COALESCE((SELECT SUM(stage.planned_amount) FROM scoped_stages stage),0)::NUMERIC
        - COALESCE((SELECT SUM(payment.payment_amount) FROM scoped_payments payment),0)::NUMERIC unpaid_amount,
      COUNT(DISTINCT contract.id) FILTER (WHERE contract.signed_date BETWEEN ?::DATE AND ?::DATE)::INTEGER period_contract_count,
      COALESCE(SUM(contract.contract_amount) FILTER (WHERE contract.signed_date BETWEEN ?::DATE AND ?::DATE),0)::NUMERIC period_contract_amount,
      COALESCE((SELECT SUM(payment.payment_amount) FROM scoped_payments payment
        WHERE payment.created_at>=?::DATE AND payment.created_at<?::DATE+INTERVAL '1 day'),0)::NUMERIC period_actual_payment_amount,
      COALESCE((SELECT SUM(payment.payment_amount) FROM scoped_payments payment
        WHERE payment.payment_month BETWEEN ?::DATE AND ?::DATE),0)::NUMERIC plan_period_payment_amount
    FROM scoped_contracts contract`
  const row = await database.prepare(sql).get(
    projectIds,
    analysisPeriod.start_date, analysisPeriod.end_date,
    analysisPeriod.start_date, analysisPeriod.end_date,
    analysisPeriod.start_date, analysisPeriod.end_date,
    plan.start_date, plan.end_date
  ) || {}
  return {
    available: true,
    contract_count: number(row.contract_count),
    contract_amount: number(row.contract_amount),
    planned_payment_amount: number(row.planned_payment_amount),
    actual_payment_amount: number(row.actual_payment_amount),
    unpaid_amount: number(row.unpaid_amount),
    period_contract_count: number(row.period_contract_count),
    period_contract_amount: number(row.period_contract_amount),
    period_actual_payment_amount: number(row.period_actual_payment_amount),
    plan_period_payment_amount: number(row.plan_period_payment_amount),
  }
}

function dataCutoff(now) {
  return new Date(now.getTime() + 8 * 3600000).toISOString().replace('Z', '+08:00')
}

async function analyzeBusinessPeriod(args, context, database = db, now = new Date()) {
  const detailQuery = validatePeriodDetailQuery(args)
  if (args.sections !== undefined && (!Array.isArray(args.sections) || !args.sections.length
    || args.sections.some(section => typeof section !== 'string' || !PERIOD_SECTIONS.includes(section))
    || new Set(args.sections).size !== args.sections.length)) {
    throw argumentError('sections', '统计块必须为不重复且非空的有效统计块名称数组')
  }
  // Detail source alone determines dependencies; sections only controls summaries.
  const selectedSections = detailQuery ? null : args.sections || null
  const detailSection = detailQuery && { flow: 'period_flows', stock: 'current_stock', plan: 'plan_outlook',
    risk: 'risk_candidates', people: 'report_people' }[detailQuery.source]
  const wants = section => detailQuery ? section === detailSection : !selectedSections || selectedSections.includes(section)
  if (args.filters?.person_scope !== undefined) {
    if (args.filters.person_scope !== 'self') throw argumentError('filters.person_scope', '人员范围只支持 self')
    if (Object.hasOwn(args.filters, 'person_ids')) throw argumentError('filters.person_ids', '本人范围不能同时提供人员标识')
    const userId = Number(context?.user?.id)
    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw Object.assign(new Error('本人范围需要已认证的员工身份'), { code: 'MCP_PERMISSION_DENIED' })
    }
    args = { ...args, filters: { ...args.filters, person_ids: [userId] } }
  }
  if (args.filters?.person_relation && !['related', 'business_role', 'creator', 'updater', 'operator'].includes(args.filters.person_relation)) {
    throw argumentError('filters.person_relation', '人员关系必须为 related、business_role、creator、updater 或 operator')
  }
  const analysisPeriod = resolvePeriod(args.analysis_period, now, 'analysis_period')
  const planPeriod = args.plan_period ? resolvePeriod(args.plan_period, now, 'plan_period') : null
  const riskPeriod = args.risk_period ? resolvePeriod(args.risk_period, now, 'risk_period') : null
  const comparisonPeriod = args.comparison_period ? resolvePeriod(args.comparison_period, now, 'comparison_period') : null
  const types = authorizedTypes(args, context)
  const detailLimit = Math.min(MAX_DETAIL_LIMIT, Math.max(0, Number(args.detail_limit ?? DEFAULT_DETAIL_LIMIT)))
  const cutoffDate = shanghaiDate(now)
  const completionCutoff = args.completion_cutoff
    ? formatDate(parseDate(args.completion_cutoff, 'completion_cutoff'))
    : planPeriod && planPeriod.end_date < cutoffDate ? planPeriod.end_date : cutoffDate
  if (completionCutoff > cutoffDate) throw argumentError('completion_cutoff', '完成截止日不能晚于上海时区今天')
  const eventTimeBasis = args.event_time_basis || 'actual'
  if (!['actual', 'recorded'].includes(eventTimeBasis)) throw argumentError('event_time_basis', '事件时间口径必须是 actual 或 recorded')
  const selectedMetrics = detailQuery?.source === 'flow' ? [detailQuery.metric]
    : args.metrics?.length ? args.metrics : Object.keys(emptyFlow())
  const requiresHistory = selectedMetrics.some(metric => metric !== 'created')
  const personNeedsHistory = args.filters?.person_ids?.length && ['related', 'operator'].includes(args.filters.person_relation || 'related')
  const needsGroupings = wants('groupings') && Boolean(args.group_by?.length)
  const needsPersonGrouping = needsGroupings && args.group_by.includes('person')
  const needsCandidatePeople = !detailQuery && detailLimit > 0 && (wants('flow_candidates') || wants('risk_candidates'))
  const needsDetailNames = Boolean(detailQuery && detailQuery.source !== 'people')
  const needsDetailOperators = needsDetailNames && detailQuery.metric !== 'workload_concentration'
  const needsPeople = wants('report_people') || needsPersonGrouping || needsCandidatePeople
  const needsPlan = Boolean(planPeriod) && (wants('plan_outlook') || needsGroupings)
  const needsFlows = wants('period_flows') || wants('flow_candidates')
    || (wants('comparison') && Boolean(comparisonPeriod)) || (wants('trend') && Boolean(args.trend_granularity)) || needsGroupings
  const needsEvents = needsFlows || wants('quality_and_delivery')
  const needsHistory = (!detailQuery && !selectedSections) || personNeedsHistory || needsPeople || needsDetailOperators || needsPlan
    || (needsFlows && requiresHistory) || wants('quality_and_delivery')
  const identityHistoryOnly = Boolean(detailQuery && !needsPlan && !(needsFlows && requiresHistory))
  const errors = []
  const componentCompleteness = {
    business_records: true, event_history: needsHistory ? true : null,
    period_flows: needsFlows ? true : null, current_stock: wants('current_stock') || needsGroupings ? true : null,
    plan_outlook: needsPlan ? true : null, report_people: needsPeople ? true : null,
    risk_candidates: wants('risk_candidates') ? true : null, financials: null,
  }
  let records = []
  let logs = []
  try {
    const recordFilters = { ...(args.filters || {}) }
    delete recordFilters.person_ids
    delete recordFilters.person_relation
    records = await loadRecords(types.authorized, recordFilters, database, cutoffDate, needsPeople && !detailQuery)
  } catch (error) {
    componentCompleteness.business_records = false
    errors.push('业务记录统计失败，当前结果不完整，请稍后重试或联系管理员')
  }
  if (needsHistory) {
    try {
      logs = await loadLogs(types.authorized, records, database, identityHistoryOnly ? analysisPeriod : null)
    } catch (error) {
      componentCompleteness.event_history = false
      errors.push('变更历史统计失败，依赖历史的统计不完整，请稍后重试或联系管理员')
    }
  }
  attachPersonRelations(records, logs, analysisPeriod)
  records = records.filter(record => matchesFilters(record, args.filters || {}, cutoffDate))
  for (const record of records) {
    record.person_ids = Object.entries(record.person_relations)
      .filter(([, relations]) => !args.filters?.person_relation || args.filters.person_relation === 'related'
        || relations.includes(args.filters.person_relation))
      .map(([id]) => Number(id))
  }
  const histories = needsHistory && !identityHistoryOnly ? buildHistories(records, logs) : new Map()
  const inconsistentHistoryCount = [...histories.values()].filter(history => history.inconsistent).length
  const historyLoaded = componentCompleteness.event_history
  componentCompleteness.event_history = needsHistory ? historyLoaded && inconsistentHistoryCount === 0 : null
  const events = needsEvents ? createEvents(records, logs, cutoffDate, eventTimeBasis, histories,
    Boolean(selectedSections || detailQuery) && !requiresHistory && !wants('quality_and_delivery')) : []
  const planSelection = selectPlanRecords(records, needsPlan ? planPeriod : null, completionCutoff, logs, cutoffDate, histories)
  let reportPeople = []
  if (needsPeople) {
    try {
      reportPeople = await buildBusinessRelatedPeople(records, logs, analysisPeriod, database)
    } catch (error) {
      componentCompleteness.report_people = false
      errors.push('业务关联人员统计失败，人员范围不完整，请稍后重试或联系管理员')
    }
  }
  let detailNamesComplete = true
  if (needsDetailNames) {
    const ids = [...new Set(records.flatMap(record => Object.keys(record.person_relations).map(Number)))]
    try {
      if (ids.length) {
        const people = await database.prepare(`/* period_analysis:people */
          SELECT id,real_name name FROM pms_user WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids)
        const names = new Map(people.map(person => [Number(person.id), person.name]))
        for (const record of records) {
          for (const id of Object.keys(record.person_relations)) record.person_names[id] = names.get(Number(id)) || record.person_names[id]
        }
      }
    } catch (error) {
      detailNamesComplete = false
      errors.push('明细关联人员姓名暂不可用，当前明细不完整，请稍后重试或联系管理员')
    }
  }
  const personNames = new Map(reportPeople.map(person => [person.user_id, person.name]))
  for (const record of records) {
    for (const id of Object.keys(record.person_relations)) {
      record.person_names[id] = personNames.get(Number(id)) || record.person_names[id] || `用户ID ${id}`
    }
  }
  let financials = { available: false }
  if (!detailQuery && wants('financials') && context?.allowedMenuPaths?.has('/projects')) {
    componentCompleteness.financials = true
    try {
      const projectIds = [...new Set(records.map(record => record.business_type === 'project' ? record.id : record.project_id)
        .filter(id => Number.isSafeInteger(id) && id > 0))]
      financials = await loadFinancials(analysisPeriod, planPeriod, database, projectIds)
    } catch (error) {
      componentCompleteness.financials = false
      errors.push('合同付款辅助统计暂不可用，不影响已完整取得的核心业务统计')
      financials = { available: false, error: '合同付款辅助统计暂不可用，请稍后重试或联系管理员' }
    }
  } else if (selectedSections && wants('financials')) {
    financials = { available: false, error: '当前账号无项目查询权限，合同付款统计不可用' }
  }
  const recordScopeComplete = componentCompleteness.business_records && (!personNeedsHistory || historyLoaded)
  if (componentCompleteness.financials === true && !recordScopeComplete) {
    componentCompleteness.financials = false
    financials = { available: false, error: '关联业务范围不完整，合同付款辅助统计不可用' }
  }
  componentCompleteness.period_flows = needsFlows ? recordScopeComplete && (!requiresHistory || componentCompleteness.event_history) : null
  componentCompleteness.current_stock = wants('current_stock') || needsGroupings ? recordScopeComplete : null
  componentCompleteness.risk_candidates = wants('risk_candidates') ? recordScopeComplete : null
  componentCompleteness.plan_outlook = needsPlan ? recordScopeComplete && historyLoaded && planSelection.unknown.length === 0 : null
  componentCompleteness.report_people = needsPeople ? componentCompleteness.report_people && recordScopeComplete && historyLoaded : null
  if (selectedSections && wants('risk_candidates') && needsCandidatePeople) {
    componentCompleteness.risk_candidates = recordScopeComplete && componentCompleteness.report_people
  }
  if (needsDetailNames) componentCompleteness[detailSection] = componentCompleteness[detailSection]
    && (!needsDetailOperators || historyLoaded) && detailNamesComplete
  const requestedComponents = detailQuery ? [{ flow: 'period_flows', stock: 'current_stock', plan: 'plan_outlook',
    risk: 'risk_candidates', people: 'report_people' }[detailQuery.source]]
    : ['period_flows', 'current_stock', 'plan_outlook', 'report_people', 'risk_candidates']
  const sectionCompleteness = selectedSections ? Object.fromEntries(selectedSections.map(section => {
    const flowComplete = componentCompleteness.period_flows
    const peopleComplete = componentCompleteness.report_people
    const complete = {
      ...componentCompleteness,
      financials: financials.available ? componentCompleteness.financials : false,
      comparison: comparisonPeriod ? flowComplete : null,
      trend: args.trend_granularity ? flowComplete : null,
      groupings: needsGroupings ? flowComplete && componentCompleteness.current_stock
        && componentCompleteness.plan_outlook !== false && (!needsPersonGrouping || peopleComplete) : null,
      quality_and_delivery: recordScopeComplete && componentCompleteness.event_history,
      flow_candidates: flowComplete && (!needsCandidatePeople || peopleComplete),
    }[section]
    return [section, complete]
  })) : null
  const statisticsComplete = selectedSections
    ? Object.values(sectionCompleteness).every(complete => complete !== false)
    : requestedComponents.every(component => componentCompleteness[component] !== false)
  const common = {
    resolved_periods: {
      analysis_period: analysisPeriod,
      plan_period: planPeriod,
      risk_period: riskPeriod,
      comparison_period: comparisonPeriod,
      completion_cutoff: completionCutoff,
      event_time_basis: eventTimeBasis,
    },
    data_cutoff: dataCutoff(now),
    coverage: {
      requested_business_types: types.requested,
      authorized_business_types: types.authorized,
      excluded_business_types: types.excluded,
      statistics_complete: statisticsComplete,
      component_completeness: componentCompleteness,
      ...(selectedSections ? { requested_sections: selectedSections, section_completeness: sectionCompleteness } : {}),
      event_history_inconsistent_count: inconsistentHistoryCount,
      event_time_basis: eventTimeBasis,
      completion_cutoff: completionCutoff,
      plan_completion_unknown_count: planSelection.unknown.length,
      plan_completion_complete: componentCompleteness.plan_outlook !== false,
      population_basis: 'current_non_deleted_records',
      historical_ledger_complete: false,
      person_relation: args.filters?.person_relation || 'related',
      event_recorded_date_fallback_count: events.filter((event) => dateInPeriod(event.date, analysisPeriod)
        && event.date_source === 'recorded_at_fallback').length,
      candidate_details_truncated: false,
      historical_stock_supported: false,
      historical_plan_versions_supported: false,
      unsupported_dimensions: ['formal_organization', 'receivables', 'budget', 'cost', 'roi', 'business_value',
        'bug_plan_dates', 'holiday_and_makeup_workdays', 'expected_resume_dates', 'business_dependencies', 'operation_permission_roster'],
      notes: [
        'BUG 未维护计划日期；workday 仅按周一至周五计算，不包含节假日与调休工作日。',
        '系统不提供统一预计恢复日期、结构化事项依赖或全量操作权限人员名册；这些能力的缺失或相关统计零值，不代表真实业务数量为零。',
        '当前存量和风险以本次执行时点为准。',
        '过去计划区间按当前有效计划日期统计，不还原历史计划版本。',
        `计划完成情况以 ${completionCutoff} 为观察截止日；区间归属仍使用当前有效计划日期及当前暂停排除规则，不表示历史承诺快照。`,
        '完成状态结合实际业务日期及可用状态操作顺序判断；pending 包含无法确认完成状态的记录，不确定数量单独披露。',
        '总体仅含当前未删除且在授权范围内的业务记录，不是包含已删除记录的完整历史台账。',
        '实际事件优先使用同次操作的业务日期；无业务日期时回退登记日期并单独计数，不用 updated_at 推断完成。',
        '缺少状态日志但当前状态和实际业务日期可证实时，actual 口径补充相应事件并标明来源；recorded 口径不虚构登记日期，不能视为完整历史台账。',
        ...(inconsistentHistoryCount ? [`${inconsistentHistoryCount} 个事项的状态历史不一致，相关事件流量不完整；仅请求新增指标时不依赖状态历史。`] : []),
        '按状态或优先级分组时保留业务类型，避免不同业务的同一数字代码混为同一含义。',
        '进入逾期按当前有效计划日和可用暂停、恢复、终态历史推导；历史计划版本、缺失暂停过程及父项目历史状态不能精确还原。',
        '人员关系分别标明负责、创建、最后更新及分析期实际操作；关联事项统计不等于个人完成工作量，人员分组不能相加作为全局合计。',
        '合同付款限于筛选后业务记录关联的项目；金额为这些项目的合同付款，不代表某个人的金额，也不是未筛选的全库金额。',
        '明细与汇总使用相同筛选和集合；明细续页必须携带 datasetToken，数据或查询范围变化时拒绝继续，不提供冻结快照。',
        ...errors,
      ],
    },
  }
  if (detailQuery) {
    let items
    let mapItem = item => item
    let tokenItem = item => item
    let membership = null
    if (detailQuery.source === 'flow') {
      items = selectFlowGroups(events, analysisPeriod, detailQuery.metric)
      mapItem = group => flowCandidate(group, cutoffDate)
      tokenItem = group => flowTokenFields(group, cutoffDate)
    } else if (detailQuery.source === 'risk') {
      items = selectRiskItems(records, cutoffDate, riskPeriod, detailQuery.metric)
      if (detailQuery.metric !== 'workload_concentration') {
        mapItem = record => candidate(record, cutoffDate)
        tokenItem = record => candidateTokenFields(record, cutoffDate)
      } else {
        const owners = new Set(items.map(item => item.owner_id))
        membership = records.filter(record => currentOverdue(record, cutoffDate))
          .map(record => [historyKey(record.business_type, record.id), [...new Set(record.owner_ids)].filter(id => owners.has(id)).sort((a, b) => a - b)])
          .filter(([, ids]) => ids.length).sort((a, b) => a[0].localeCompare(b[0]))
      }
    } else if (detailQuery.source === 'people') {
      items = reportPeople
      const people = new Set(items.map(item => item.user_id))
      membership = records.map(record => [historyKey(record.business_type, record.id),
        Object.entries(record.person_relations).filter(([id]) => people.has(Number(id)))])
        .filter(([, relations]) => relations.length).sort((a, b) => a[0].localeCompare(b[0]))
    } else {
      const selectors = {
        total: () => true,
        unfinished: isUnfinished,
        in_progress: record => BUSINESS_TYPES[record.business_type].inProgress.includes(record.status),
        paused: record => record.is_paused,
        overdue: record => currentOverdue(record, cutoffDate),
      }
      const selected = detailQuery.source === 'plan'
        ? planSelection[detailQuery.metric]
        : records.filter(selectors[detailQuery.metric])
      const unknown = new Set(planSelection.unknown)
      items = [...selected].sort((a, b) => a.business_type.localeCompare(b.business_type) || a.id - b.id)
      mapItem = record => ({ ...candidate(record, cutoffDate), ...(detailQuery.source === 'plan' ? { completion_unknown: unknown.has(record) } : {}) })
      tokenItem = record => [candidateTokenFields(record, cutoffDate), ...(detailQuery.source === 'plan'
        ? [completionStateAt(record, completionCutoff, histories.get(historyKey(record.business_type, record.id)), cutoffDate)] : [])]
    }
    const datasetToken = createPeriodDatasetToken({
      version: 2, user_id: context?.user?.id ?? null, allowed_menu_paths: [...(context?.allowedMenuPaths || [])].sort(),
      query: { analysisPeriod, planPeriod, riskPeriod, comparisonPeriod, completionCutoff, eventTimeBasis, cutoffDate,
        business_types: types.requested, filters: args.filters || {}, metrics: args.metrics || [],
        source: detailQuery.source, metric: detailQuery.metric, page_size: detailQuery.pageSize },
      complete: componentCompleteness[detailSection],
      membership,
    }, items, tokenItem)
    assertPeriodDatasetToken(detailQuery, datasetToken)
    const details = paginatePeriodDetails({ ...detailQuery, datasetToken }, items, mapItem)
    return {
      ...common, coverage: { ...common.coverage, candidate_details_truncated: details.items.length < details.total }, details,
    }
  }
  const periodFlows = wants('period_flows') || (wants('comparison') && comparisonPeriod)
    ? summarizeFlow(types.authorized, events, analysisPeriod) : null
  const flowCandidates = wants('flow_candidates') ? buildFlowCandidates(events, analysisPeriod, args.metrics, detailLimit, cutoffDate) : {}
  const riskCandidates = wants('risk_candidates') ? buildRisks(records, cutoffDate, riskPeriod, detailLimit) : {}
  const result = {
    ...common,
    ...(wants('period_flows') ? { period_flows: periodFlows } : {}),
    ...(wants('current_stock') ? { current_stock: summarizeStock(types.authorized, records, cutoffDate) } : {}),
    ...(wants('plan_outlook') ? { plan_outlook: summarizePlan(types.authorized, records, planPeriod, completionCutoff, logs, cutoffDate, histories) } : {}),
    ...(wants('comparison') ? { comparison: comparisonPeriod ? flowComparison(periodFlows, summarizeFlow(types.authorized, events, comparisonPeriod)) : null } : {}),
    ...(wants('trend') ? { trend: buildTrend(events, analysisPeriod, args.trend_granularity) } : {}),
    ...(wants('groupings') ? { groupings: buildGroupings(args.group_by || [], records, events, analysisPeriod, planPeriod, cutoffDate, completionCutoff, logs, histories) } : {}),
    ...(wants('quality_and_delivery') ? { quality_and_delivery: qualitySummary(records, events, analysisPeriod) } : {}),
    ...(wants('financials') ? { financials } : {}),
    ...(wants('flow_candidates') ? { flow_candidates: flowCandidates } : {}),
    ...(wants('risk_candidates') ? { risk_candidates: riskCandidates } : {}),
    ...(wants('report_people') ? { report_people: reportPeople } : {}),
    coverage: { ...common.coverage, candidate_details_truncated: [...Object.values(flowCandidates), ...Object.values(riskCandidates)]
      .some(value => value.has_more) },
  }
  return applyMetricSelection(result, args.metrics)
}

module.exports = {
  BUSINESS_TYPES,
  MAX_PERIOD_DAYS,
  SHANGHAI_TIME_ZONE,
  analyzeBusinessPeriod,
  resolvePeriod,
  selectPlanRecords,
}
