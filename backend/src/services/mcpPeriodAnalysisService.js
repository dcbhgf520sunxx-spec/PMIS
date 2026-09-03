const db = require('../db')

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
      ARRAY[p.owner_id] owner_ids,
      ARRAY_REMOVE(ARRAY[p.owner_id,p.creator_id] || COALESCE((SELECT ARRAY_AGG(member.user_id ORDER BY member.user_id)
        FROM pms_project_member member WHERE member.project_id=p.id),'{}'::BIGINT[]),NULL) person_ids,
      p.expected_end_date plan_date,p.actual_end_date actual_date,
      p.created_at,p.is_overdue,(p.status=3) is_paused,(p.status=2) is_completed,
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
      ARRAY[r.owner_id] owner_ids,ARRAY_REMOVE(ARRAY[r.owner_id,r.creator_id],NULL) person_ids,
      r.expected_end_date plan_date,r.actual_end_date actual_date,
      r.created_at,COALESCE(r.is_overdue,0) is_overdue,(r.status=35) is_paused,
      (r.status IN (33,34)) is_completed,FALSE parent_project_paused,FALSE required_delivery,0 delivery_count
    FROM pms_requirement r
    JOIN pms_product product ON product.id=r.product_id
    LEFT JOIN pms_user owner ON owner.id=r.owner_id
    WHERE r.is_deleted=0`,
  stage_plan: `/* period_analysis:records:stage_plan */
    SELECT 'stage_plan' business_type,item.id,item.name,item.status,project.priority,
      product.id product_id,product.name product_name,project.id project_id,project.name project_name,
      project.requirement_id,requirement.title requirement_name,item.owner_id,owner.real_name owner_name,
      ARRAY[item.owner_id] || COALESCE((SELECT ARRAY_AGG(c.user_id ORDER BY c.sort_order,c.user_id)
        FROM pms_project_plan_item_collaborator c WHERE c.plan_item_id=item.id),'{}'::BIGINT[]) owner_ids,
      ARRAY_REMOVE(ARRAY[item.owner_id,item.creator_id] || COALESCE((SELECT ARRAY_AGG(c.user_id ORDER BY c.sort_order,c.user_id)
        FROM pms_project_plan_item_collaborator c WHERE c.plan_item_id=item.id),'{}'::BIGINT[]),NULL) person_ids,
      item.current_due_date plan_date,item.actual_end_date actual_date,item.created_at,
      CASE WHEN item.status NOT IN (2,3) AND item.current_due_date<CURRENT_DATE THEN 1 ELSE 0 END is_overdue,
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
      owners.owner_id,owners.owner_name,COALESCE(owners.owner_ids,'{}'::BIGINT[]) owner_ids,
      ARRAY_REMOVE(COALESCE(owners.owner_ids,'{}'::BIGINT[]) || ARRAY[t.creator_id],NULL) person_ids,
      t.expected_end_date plan_date,t.actual_end_date actual_date,t.created_at,t.is_overdue,
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
      b.assignee_id owner_id,owner.real_name owner_name,ARRAY[b.assignee_id] owner_ids,
      ARRAY_REMOVE(ARRAY[b.assignee_id,b.creator_id],NULL) person_ids,
      NULL::DATE plan_date,b.closed_date actual_date,b.created_at,0 is_overdue,FALSE is_paused,
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
      owner.real_name owner_name,ARRAY[w.follower_id] owner_ids,
      ARRAY_REMOVE(ARRAY[w.follower_id,w.creator_id],NULL) person_ids,w.expected_resolve_date::DATE plan_date,
      w.resolve_date::DATE actual_date,w.created_at,w.is_overdue,(w.status=4) is_paused,
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
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? String(value)
    : shanghaiDate(new Date(value))
  return date >= period.start_date && date <= period.end_date
}

function dateOnly(value) {
  if (!value) return null
  const text = String(value)
  return /^\d{4}-\d{2}-\d{2}/.test(text) && !text.includes('T')
    ? text.slice(0, 10)
    : shanghaiDate(new Date(value))
}

function number(value) {
  const result = Number(value || 0)
  return Number.isFinite(result) ? result : 0
}

function normalizeRecord(row) {
  const ownerIds = Array.isArray(row.owner_ids) ? row.owner_ids.map(Number) : row.owner_id ? [Number(row.owner_id)] : []
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
    owner_ids: ownerIds,
    person_ids: personIds,
    person_names: personNames,
    plan_date: dateOnly(row.plan_date),
    actual_date: dateOnly(row.actual_date),
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
  if (Array.isArray(filters.person_ids) && filters.person_ids.length
    && !record.person_ids.some((id) => filters.person_ids.map(Number).includes(Number(id)))) return false
  if (Array.isArray(filters.statuses) && filters.statuses.length
    && !filters.statuses.map(Number).includes(record.status)) return false
  if (Array.isArray(filters.priorities) && filters.priorities.length
    && !filters.priorities.map(Number).includes(record.priority)) return false
  if (filters.only_overdue === true && !currentOverdue(record, cutoffDate)) return false
  if (filters.only_paused === true && !record.is_paused) return false
  return true
}

async function loadRecords(types, filters, database, cutoffDate) {
  const results = await Promise.all(types.map(async (type) => {
    const rows = await database.prepare(RECORD_QUERIES[type]).all()
    return rows.map(normalizeRecord)
  }))
  const records = results.flat()
  const missingPersonIds = [...new Set(records.flatMap((record) => record.person_ids
    .filter((id) => !record.person_names[id])))]
  if (missingPersonIds.length) {
    const people = await database.prepare(`/* period_analysis:people */
      SELECT id,real_name name FROM pms_user WHERE id IN (${missingPersonIds.map(() => '?').join(',')})`).all(...missingPersonIds)
    const names = new Map(people.map((person) => [Number(person.id), person.name]))
    for (const record of records) {
      for (const id of record.person_ids) record.person_names[id] ||= names.get(id) || `用户ID ${id}`
    }
  }
  return records.filter((record) => matchesFilters(record, filters, cutoffDate))
}

async function loadLogs(types, analysisPeriod, comparisonPeriod, database) {
  if (!types.length) return []
  const moduleCases = types.map((type) => `WHEN '${BUSINESS_TYPES[type].module}' THEN '${type}'`).join(' ')
  const modules = types.map((type) => BUSINESS_TYPES[type].module)
  const startDate = [analysisPeriod.start_date, comparisonPeriod?.start_date].filter(Boolean).sort()[0]
  const endDate = [analysisPeriod.end_date, comparisonPeriod?.end_date].filter(Boolean).sort().at(-1)
  const placeholders = modules.map(() => '?').join(',')
  const sql = `/* period_analysis:logs */
    SELECT CASE module ${moduleCases} END business_type,target_id,operation_id,action,
      field_name,old_value,new_value,created_at
    FROM pms_op_log
    WHERE module IN (${placeholders})
      AND created_at>=?::DATE AND created_at<?::DATE+INTERVAL '1 day'
    ORDER BY created_at,id`
  return database.prepare(sql).all(...modules, startDate, endDate)
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

function overdueDate(record, completionDate, reopenedDate) {
  if (!record.plan_date || record.business_type === 'bug') return null
  if (record.business_type === 'stage_plan' && record.parent_project_paused) return null
  const due = parseDate(record.plan_date)
  const dueEntered = formatDate(addDays(due, 1))
  let entered = record.created_date && record.created_date > dueEntered ? record.created_date : dueEntered
  if (record.is_completed && completionDate && completionDate <= record.plan_date) return null
  if (!record.is_completed && reopenedDate && reopenedDate > entered) entered = reopenedDate
  return entered
}

function createEvents(records, logs, cutoffDate) {
  const recordMap = new Map(records.map((record) => [`${record.business_type}:${record.id}`, record]))
  const events = []
  for (const record of records) {
    if (record.created_date) events.push({ type: 'created', date: record.created_date, record })
  }

  const dedupe = new Set()
  const operationFields = new Map()
  const importantFields = new Set([
    'owner_id', 'owner_ids', 'member_ids', 'assignee_id', 'follower_id', 'collaborator_ids',
    'expected_end_date', 'expected_resolve_date', 'current_due_date', 'priority', 'severity', 'urgency',
  ])
  for (const log of logs) {
    if (!log.operation_id) continue
    const key = `${log.business_type}:${Number(log.target_id)}:${log.operation_id}`
    if (!operationFields.has(key)) operationFields.set(key, new Map())
    operationFields.get(key).set(log.field_name, log)
  }
  for (const log of logs) {
    const record = recordMap.get(`${log.business_type}:${Number(log.target_id)}`)
    if (!record || String(log.old_value ?? '') === String(log.new_value ?? '')) continue
    const date = dateOnly(log.created_at)
    if (log.field_name === 'status') {
      const eventType = statusEvent(record.business_type, log.old_value, log.new_value)
      if (eventType) {
        const key = `${eventType}:${record.business_type}:${record.id}:${date}`
        if (!dedupe.has(key)) {
          dedupe.add(key)
          const related = operationFields.get(`${record.business_type}:${record.id}:${log.operation_id}`)
          const completionField = record.business_type === 'bug' ? 'closed_date'
            : record.business_type === 'work_order' ? 'resolve_date'
              : 'actual_end_date'
          const actualDate = dateOnly(related?.get(completionField)?.new_value) || date
          events.push({ type: eventType, date, actual_date: actualDate, record, log })
        }
      }
      if (['paused', 'resumed'].includes(eventType)) {
        const key = `important_adjustments:${record.business_type}:${record.id}:${log.operation_id || `${date}:status:${log.new_value}`}`
        if (!dedupe.has(key)) {
          dedupe.add(key)
          events.push({ type: 'important_adjustments', date, record, log, changes: [log] })
        }
      }
    }
    if (importantFields.has(log.field_name)) {
      const key = `important_adjustments:${record.business_type}:${record.id}:${log.operation_id || `${date}:${log.field_name}`}`
      if (!dedupe.has(key)) {
        dedupe.add(key)
        const changes = log.operation_id
          ? [...(operationFields.get(`${record.business_type}:${record.id}:${log.operation_id}`)?.values() || [])]
            .filter((item) => importantFields.has(item.field_name)
              && String(item.old_value ?? '') !== String(item.new_value ?? ''))
          : [log]
        events.push({ type: 'important_adjustments', date, record, log, changes })
      }
    }
  }
  for (const record of records) {
    const completionDate = events
      .filter((event) => event.type === 'completed'
        && event.record.business_type === record.business_type && event.record.id === record.id)
      .map((event) => event.actual_date || event.date)
      .sort()[0] || record.actual_date
    const reopenedDate = events
      .filter((event) => event.record.business_type === record.business_type && event.record.id === record.id
        && (event.type === 'reopened'
          || (event.type === 'activated' && isCompletedStatus(record.business_type, event.log?.old_value))))
      .map((event) => event.date)
      .sort().at(-1)
    const enteredOverdue = overdueDate(record, completionDate, reopenedDate)
    if (!enteredOverdue) continue
    events.push({ type: 'became_overdue', date: enteredOverdue, record })
    if (!record.is_completed && currentOverdue(record, cutoffDate)) {
      events.push({ type: 'new_overdue_unresolved', date: enteredOverdue, record })
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
  if (record.is_completed || record.is_paused || !record.plan_date) return false
  if (record.business_type === 'stage_plan' && record.parent_project_paused) return false
  return record.is_overdue || record.plan_date < cutoffDate
}

function summarizeStock(types, records, cutoffDate) {
  const summarize = (items) => ({
    total: items.length,
    unfinished: items.filter((record) => !record.is_completed).length,
    in_progress: items.filter((record) => BUSINESS_TYPES[record.business_type].inProgress.includes(record.status)).length,
    paused: items.filter((record) => record.is_paused).length,
    overdue: items.filter((record) => currentOverdue(record, cutoffDate)).length,
  })
  return {
    by_business_type: Object.fromEntries(types.map((type) => [type, summarize(records.filter((record) => record.business_type === type))])),
    total: summarize(records),
  }
}

function summarizePlan(types, records, planPeriod) {
  if (!planPeriod) return null
  const summarize = (items) => {
    const planned = items.filter((record) => !record.is_paused && !record.parent_project_paused
      && dateInPeriod(record.plan_date, planPeriod)
      && (!record.actual_date || record.actual_date >= planPeriod.start_date))
    const completed = planned.filter((record) => record.actual_date
      && dateInPeriod(record.actual_date, planPeriod)).length
    return { planned: planned.length, completed, pending: planned.length - completed }
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
  result.period_flows.total = selectFlowMetrics(result.period_flows.total, metrics)
  for (const type of Object.keys(result.period_flows.by_business_type)) {
    result.period_flows.by_business_type[type] = selectFlowMetrics(result.period_flows.by_business_type[type], metrics)
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
  for (const event of uniquePeriodEvents(events, period)) {
    const key = bucketKey(event.date, granularity)
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
    status: [record.status, String(record.status)],
    priority: [record.priority, record.priority === null ? null : String(record.priority)],
    plan_date: [record.plan_date, record.plan_date],
  }
  return mapping[dimension] || [null, null]
}

function buildGroupings(dimensions, records, events, analysisPeriod, planPeriod, cutoffDate) {
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
    result[dimension] = [...groups.values()].map((group) => {
      const ids = new Set(group.records.map((record) => `${record.business_type}:${record.id}`))
      const groupEvents = events.filter((event) => ids.has(`${event.record.business_type}:${event.record.id}`))
      return {
        key: group.key,
        label: group.label,
        period_flows: summarizeFlow([...new Set(group.records.map((record) => record.business_type))], groupEvents, analysisPeriod).total,
        current_stock: summarizeStock([...new Set(group.records.map((record) => record.business_type))], group.records, cutoffDate).total,
        plan_outlook: summarizePlan([...new Set(group.records.map((record) => record.business_type))], group.records, planPeriod)?.total || null,
      }
    })
  }
  return result
}

function candidate(record, cutoffDate) {
  return {
    business_type: record.business_type,
    business_type_label: BUSINESS_TYPES[record.business_type].label,
    target_id: record.id,
    name: record.name,
    project_name: record.project_name || null,
    owner_name: record.owner_name || null,
    status: record.status,
    priority: record.priority,
    plan_date: record.plan_date,
    overdue_days: record.plan_date && record.plan_date < cutoffDate
      ? daysInRange(parseDate(record.plan_date), parseDate(cutoffDate)) - 1
      : 0,
  }
}

function limitedCandidates(items, limit, cutoffDate) {
  const sorted = [...items].sort((a, b) => {
    const byPriority = number(b.priority) - number(a.priority)
    if (byPriority) return byPriority
    return String(a.plan_date || '9999-12-31').localeCompare(String(b.plan_date || '9999-12-31'))
  })
  return {
    items: sorted.slice(0, limit).map((record) => candidate(record, cutoffDate)),
    total: sorted.length,
    has_more: sorted.length > limit,
  }
}

function flowCandidate(group, cutoffDate) {
  const event = [...group].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
  const changes = group.flatMap((item) => item.changes || (item.log ? [item.log] : [])).map((change) => ({
    event_date: dateOnly(change.created_at) || event.date,
    field_name: change.field_name,
    old_value: change.old_value ?? null,
    new_value: change.new_value ?? null,
  }))
  return {
    ...candidate(event.record, cutoffDate),
    event_date: event.date,
    actual_date: event.actual_date || event.record.actual_date || null,
    changes,
  }
}

function buildFlowCandidates(events, period, metrics, limit, cutoffDate) {
  const selected = Array.isArray(metrics) && metrics.length ? metrics : Object.keys(emptyFlow())
  const periodEvents = events.filter((event) => dateInPeriod(event.date, period))
  return Object.fromEntries(selected.map((type) => {
    const groups = new Map()
    for (const event of periodEvents.filter((item) => item.type === type)) {
      const key = `${event.record.business_type}:${event.record.id}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(event)
    }
    const items = [...groups.values()].map((group) => flowCandidate(group, cutoffDate))
      .sort((a, b) => String(b.event_date).localeCompare(String(a.event_date))
        || Number(b.priority || 0) - Number(a.priority || 0))
    return [type, {
      items: items.slice(0, limit),
      total: items.length,
      has_more: items.length > limit,
    }]
  }))
}

function buildRisks(records, cutoffDate, riskPeriod, limit) {
  const period = riskPeriod || {
    start_date: cutoffDate,
    end_date: formatDate(addDays(parseDate(cutoffDate), 7)),
  }
  const overdue = records.filter((record) => currentOverdue(record, cutoffDate))
  const dueSoon = records.filter((record) => !record.is_completed && !record.is_paused
    && !record.parent_project_paused
    && dateInPeriod(record.plan_date, period))
  const paused = records.filter((record) => record.is_paused)
  const missingDelivery = records.filter((record) => record.business_type === 'stage_plan'
    && record.required_delivery && record.delivery_count === 0 && !record.parent_project_paused)
  const missingPlanDate = records.filter((record) => !record.plan_date && !['bug'].includes(record.business_type))
  const ownerCounts = new Map()
  for (const record of overdue) {
    if (!record.owner_id) continue
    const item = ownerCounts.get(record.owner_id) || { owner_id: record.owner_id, owner_name: record.owner_name, overdue_count: 0 }
    item.overdue_count += 1
    ownerCounts.set(record.owner_id, item)
  }
  const concentration = [...ownerCounts.values()].filter((item) => item.overdue_count >= 2)
    .sort((a, b) => b.overdue_count - a.overdue_count)
  return {
    overdue: limitedCandidates(overdue, limit, cutoffDate),
    due_soon: limitedCandidates(dueSoon, limit, cutoffDate),
    paused: limitedCandidates(paused, limit, cutoffDate),
    missing_delivery: limitedCandidates(missingDelivery, limit, cutoffDate),
    missing_plan_date: limitedCandidates(missingPlanDate, limit, cutoffDate),
    workload_concentration: {
      items: concentration.slice(0, limit), total: concentration.length, has_more: concentration.length > limit,
    },
  }
}

function qualitySummary(records, events, period) {
  const periodEvents = uniquePeriodEvents(events, period)
  const completed = periodEvents.filter((event) => event.type === 'completed')
  const onTime = completed.filter((event) => event.record.plan_date
    && (event.actual_date || event.date) <= event.record.plan_date).length
  const delayed = completed.filter((event) => event.record.plan_date
    && (event.actual_date || event.date) > event.record.plan_date).length
  const scheduleAdjustments = periodEvents.filter((event) => event.type === 'important_adjustments'
    && ['expected_end_date', 'expected_resolve_date', 'current_due_date'].includes(event.log?.field_name)
  ).length
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

async function loadFinancials(analysisPeriod, planPeriod, database) {
  const plan = planPeriod || analysisPeriod
  const sql = `/* period_analysis:financials */
    SELECT
      COUNT(DISTINCT contract.id)::INTEGER contract_count,
      COALESCE(SUM(contract.contract_amount),0)::NUMERIC contract_amount,
      COALESCE((SELECT SUM(stage.planned_amount) FROM pms_project_payment_stage stage
        JOIN pms_project_contract c ON c.id=stage.contract_id AND c.is_deleted=0
        WHERE stage.is_deleted=0),0)::NUMERIC planned_payment_amount,
      COALESCE((SELECT SUM(payment.payment_amount) FROM pms_project_payment_record payment
        JOIN pms_project_payment_stage stage ON stage.id=payment.stage_id AND stage.is_deleted=0
        JOIN pms_project_contract c ON c.id=stage.contract_id AND c.is_deleted=0
        WHERE payment.is_deleted=0),0)::NUMERIC actual_payment_amount,
      COALESCE((SELECT SUM(stage.planned_amount) FROM pms_project_payment_stage stage
        JOIN pms_project_contract c ON c.id=stage.contract_id AND c.is_deleted=0
        WHERE stage.is_deleted=0),0)::NUMERIC
        - COALESCE((SELECT SUM(payment.payment_amount) FROM pms_project_payment_record payment
          JOIN pms_project_payment_stage stage ON stage.id=payment.stage_id AND stage.is_deleted=0
          JOIN pms_project_contract c ON c.id=stage.contract_id AND c.is_deleted=0
          WHERE payment.is_deleted=0),0)::NUMERIC unpaid_amount,
      COUNT(DISTINCT contract.id) FILTER (WHERE contract.signed_date BETWEEN ?::DATE AND ?::DATE)::INTEGER period_contract_count,
      COALESCE(SUM(contract.contract_amount) FILTER (WHERE contract.signed_date BETWEEN ?::DATE AND ?::DATE),0)::NUMERIC period_contract_amount,
      COALESCE((SELECT SUM(payment.payment_amount) FROM pms_project_payment_record payment
        WHERE payment.is_deleted=0 AND payment.created_at>=?::DATE AND payment.created_at<?::DATE+INTERVAL '1 day'),0)::NUMERIC period_actual_payment_amount,
      COALESCE((SELECT SUM(payment.payment_amount) FROM pms_project_payment_record payment
        WHERE payment.is_deleted=0 AND payment.payment_month BETWEEN ?::DATE AND ?::DATE),0)::NUMERIC plan_period_payment_amount
    FROM pms_project_contract contract WHERE contract.is_deleted=0`
  const row = await database.prepare(sql).get(
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
  const analysisPeriod = resolvePeriod(args.analysis_period, now, 'analysis_period')
  const planPeriod = args.plan_period ? resolvePeriod(args.plan_period, now, 'plan_period') : null
  const riskPeriod = args.risk_period ? resolvePeriod(args.risk_period, now, 'risk_period') : null
  const comparisonPeriod = args.comparison_period ? resolvePeriod(args.comparison_period, now, 'comparison_period') : null
  const types = authorizedTypes(args, context)
  const detailLimit = Math.min(MAX_DETAIL_LIMIT, Math.max(0, Number(args.detail_limit ?? DEFAULT_DETAIL_LIMIT)))
  const cutoffDate = shanghaiDate(now)
  const errors = []
  let records = []
  let logs = []
  try {
    records = await loadRecords(types.authorized, args.filters || {}, database, cutoffDate)
  } catch (error) {
    errors.push(`业务记录统计失败：${error.message}`)
  }
  try {
    logs = await loadLogs(types.authorized, analysisPeriod, comparisonPeriod, database)
  } catch (error) {
    errors.push(`变更历史统计失败：${error.message}`)
  }
  const events = createEvents(records, logs, cutoffDate)
  const periodFlows = summarizeFlow(types.authorized, events, analysisPeriod)
  const currentStock = summarizeStock(types.authorized, records, cutoffDate)
  const planOutlook = summarizePlan(types.authorized, records, planPeriod)
  const flowCandidates = buildFlowCandidates(events, analysisPeriod, args.metrics, detailLimit, cutoffDate)
  const riskCandidates = buildRisks(records, cutoffDate, riskPeriod, detailLimit)
  let financials = { available: false }
  if (context?.allowedMenuPaths?.has('/projects')) {
    try {
      financials = await loadFinancials(analysisPeriod, planPeriod, database)
    } catch (error) {
      errors.push(`合同付款统计失败：${error.message}`)
      financials = { available: false, error: error.message }
    }
  }
  return applyMetricSelection({
    resolved_periods: {
      analysis_period: analysisPeriod,
      plan_period: planPeriod,
      risk_period: riskPeriod,
      comparison_period: comparisonPeriod,
    },
    data_cutoff: dataCutoff(now),
    period_flows: periodFlows,
    current_stock: currentStock,
    plan_outlook: planOutlook,
    comparison: comparisonPeriod
      ? flowComparison(periodFlows, summarizeFlow(types.authorized, events, comparisonPeriod))
      : null,
    trend: buildTrend(events, analysisPeriod, args.trend_granularity),
    groupings: buildGroupings(args.group_by || [], records, events, analysisPeriod, planPeriod, cutoffDate),
    quality_and_delivery: qualitySummary(records, events, analysisPeriod),
    financials,
    flow_candidates: flowCandidates,
    risk_candidates: riskCandidates,
    coverage: {
      requested_business_types: types.requested,
      authorized_business_types: types.authorized,
      excluded_business_types: types.excluded,
      statistics_complete: errors.length === 0,
      candidate_details_truncated: [...Object.values(flowCandidates), ...Object.values(riskCandidates)]
        .some((value) => value.has_more),
      historical_stock_supported: false,
      historical_plan_versions_supported: false,
      unsupported_dimensions: ['formal_organization', 'receivables', 'budget', 'cost', 'roi', 'business_value'],
      notes: [
        '当前存量和风险以本次执行时点为准。',
        '过去计划区间按当前有效计划日期统计，不还原历史计划版本。',
        ...errors,
      ],
    },
  }, args.metrics)
}

module.exports = {
  BUSINESS_TYPES,
  MAX_PERIOD_DAYS,
  SHANGHAI_TIME_ZONE,
  analyzeBusinessPeriod,
  resolvePeriod,
}
