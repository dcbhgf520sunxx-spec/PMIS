const { calculateOverdue } = require('./overdueRules')
const { validateActualBusinessDate } = require('./actualBusinessDateRules')
const { BUSINESS_FIELD_LIMITS } = require('./businessFieldRules')

function normalizeMemberIds(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
}

function validateProjectStatusChange(status, values = {}, today) {
  if (Number(status) === 2 && !values.actual_end_date) return '请选择实际完成日期'
  if (Number(status) === 3 && !values.suspend_date) return '请选择暂停日期'
  if (Number(status) === 3 && !String(values.suspend_reason || '').trim()) return '请输入暂停原因'
  if (Number(status) === 3 && String(values.suspend_reason || '').trim().length > BUSINESS_FIELD_LIMITS.pauseReason) return `暂停原因最多${BUSINESS_FIELD_LIMITS.pauseReason}字符`
  if (Number(status) === 4 && !values.close_date) return '请填写关闭时间'
  if (Number(status) === 4 && !String(values.close_reason || '').trim()) return '请填写关闭原因'
  if (Number(status) === 4 && String(values.close_reason || '').trim().length > BUSINESS_FIELD_LIMITS.pauseReason) return `关闭原因最多${BUSINESS_FIELD_LIMITS.pauseReason}字符`
  if (Number(status) === 4) return validateActualBusinessDate(values.close_date, '关闭时间', today)
  return Number(status) === 2
    ? validateActualBusinessDate(values.actual_end_date, '实际完成日期', today)
    : null
}

function calculateProjectOverdue(date, status, today) {
  return calculateOverdue('project', { date, status }, today).isOverdue
}

function allowedProjectStatuses(currentStatus) {
  const current = Number(currentStatus)
  if (current === 3) return [0, 1, 2, 4]
  return { 0: [1, 3, 4], 1: [2, 3, 4], 2: [3, 4], 4: [0, 1, 2, 3] }[current] || []
}

module.exports = { normalizeMemberIds, validateProjectStatusChange, calculateProjectOverdue, allowedProjectStatuses }
