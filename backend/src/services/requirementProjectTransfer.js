const { validateRequirementRelease, resolveRequirementStatusFields, calculateRequirementOverdue } = require('./requirementRules')

function transferError(message) {
  const error = new Error(message)
  error.field = 'requirement_release'
  return error
}
async function lockRequirements(tx, ids) {
  const unique = [...new Set(ids.filter(Boolean).map(Number))].sort((a, b) => a - b)
  if (!unique.length) return []
  return tx.prepare(`SELECT * FROM pms_requirement WHERE id IN (${unique.map(() => '?').join(',')}) AND is_deleted=0 ORDER BY id FOR UPDATE`).all(...unique)
}
async function releaseRequirement(tx, row, values, user, ip, projectName) {
  if (!row) throw transferError('原需求不存在')
  const error = validateRequirementRelease(row.requirement_type, values)
  if (error) throw transferError(error)
  const status = Number(values.status)
  const fields = resolveRequirementStatusFields(row, status, values)
  const next = { status, actual_end_date: fields.actualEndDate, completion_status: fields.completionStatus, pause_date: fields.pauseDate, pause_reason: fields.pauseReason, is_overdue: calculateRequirementOverdue(row.expected_end_date, status) }
  await tx.prepare('UPDATE pms_requirement SET status=?,actual_end_date=?,completion_status=?,pause_date=?,pause_reason=?,is_overdue=?,updater_id=?,updated_at=NOW() WHERE id=?').run(...Object.values(next), user, row.id)
  await tx.writeLogs(user, '项目解除关联', '需求', row.id, [{ field: '关联项目', oldVal: projectName, newVal: null }, ...Object.entries(next).filter(([field, value]) => String(row[field] ?? '') !== String(value ?? '')).map(([field, value]) => ({ field, oldVal: row[field], newVal: value }))], ip, row.title)
}
async function transferRequirement(tx, row, user, ip, projectName) {
  if (!row) throw transferError('来源需求不存在')
  await tx.prepare('UPDATE pms_requirement SET status=36,is_overdue=NULL,updater_id=?,updated_at=NOW() WHERE id=?').run(user, row.id)
  const changes = [{ field: '关联项目', oldVal: null, newVal: projectName }, { field: 'status', oldVal: row.status, newVal: 36 }]
  if (row.is_overdue !== null) changes.push({ field: 'is_overdue', oldVal: row.is_overdue, newVal: null })
  await tx.writeLogs(user, '转项目', '需求', row.id, changes, ip, row.title)
}
module.exports = { lockRequirements, releaseRequirement, transferRequirement }
