const { requirementCompletion, requirementCompletionSql } = require('./requirementCompletionRules')
const { getShanghaiDateText, businessDateText, calendarDaysBetween } = require('../utils/date')

const POLICIES = Object.freeze({
  project: { excluded: [2, 3, 4], field: 'expected_end_date', inactive: 0 },
  requirement: { excluded: [37], field: 'expected_end_date', inactive: null },
  task: { excluded: [2, 3, 4], field: 'expected_end_date', inactive: 0 },
  work_order: { excluded: [2, 3, 4], field: 'expected_resolve_date', inactive: 0, timestamp: true },
  stage_plan: { excluded: [2, 3], field: 'current_due_date', inactive: 0 },
})
function policyFor(type) {
  if (!Object.hasOwn(POLICIES, type)) throw new Error('Unknown overdue business type')
  return POLICIES[type]
}
function calculateOverdue(type, { date, status, parentStatus, requirementType, completion }, today = getShanghaiDateText()) {
  const policy = policyFor(type)
  if (policy.excluded.includes(Number(status)) || (type === 'stage_plan' && [3, 4].includes(Number(parentStatus)))) {
    return { isOverdue: policy.inactive, overdueDays: 0 }
  }
  if (type === 'requirement' && (completion === undefined
    ? requirementCompletion({ requirement_type: requirementType ?? ({ 2: 1, 3: 1, 12: 2, 13: 2, 21: 3, 22: 3 }[Number(status)] || 4) }, Number(status), today, null).completed : completion) !== false) {
    return { isOverdue: null, overdueDays: 0 }
  }
  const due = businessDateText(date, Boolean(policy.timestamp))
  if (type === 'requirement' && !due) return { isOverdue: null, overdueDays: 0 }
  const days = due ? Math.max(0, calendarDaysBetween(today, due)) : 0
  return { isOverdue: days > 0 ? 1 : 0, overdueDays: days }
}
// Identifiers are internal code, never request parameters. Values stay parameterized by callers.
function overdueSql(type, { alias = '', parentAlias } = {}) {
  const policy = policyFor(type)
  for (const name of [alias, parentAlias]) if (name && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error('Invalid SQL alias')
  const prefix = alias ? `${alias}.` : ''
  const today = "(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai')::date"
  const date = policy.timestamp ? `(${prefix}${policy.field} AT TIME ZONE 'Asia/Shanghai')::date` : `${prefix}${policy.field}`
  if (type === 'requirement') {
    const complete = requirementCompletionSql(alias || 'pms_requirement')
    const flag = `(CASE WHEN ${prefix}status=37 OR ${date} IS NULL OR (${complete}) IS DISTINCT FROM FALSE THEN NULL WHEN ${date} < ${today} THEN 1 ELSE 0 END)`
    const predicate = `(${flag}=1)`
    const days = `(CASE WHEN ${predicate} THEN (${today}-${date}) ELSE 0 END)`
    const pending = `(${prefix}status<>37 AND ${date} IS NOT NULL AND (${complete}) IS NULL)`
    return { predicate, flag, days, fields: `${flag} AS is_overdue, ${days} AS overdue_days, ${pending} AS overdue_pending, ${complete} AS requirement_completion` }
  }
  const active = `${prefix}status NOT IN (${policy.excluded.join(',')})${type === 'stage_plan' && parentAlias ? ` AND ${parentAlias}.status NOT IN (3,4)` : ''}`
  const predicate = `(${active} AND ${date} IS NOT NULL AND ${date} < ${today})`
  const flag = `(CASE WHEN NOT (${active}) THEN ${policy.inactive === null ? 'NULL' : '0'} WHEN ${date} < ${today} THEN 1 ELSE 0 END)`
  const days = `(CASE WHEN ${predicate} THEN (${today} - ${date}) ELSE 0 END)`
  return { predicate, flag, days, fields: `${flag} AS is_overdue, ${days} AS overdue_days` }
}
module.exports = { POLICIES, calculateOverdue, overdueSql }
