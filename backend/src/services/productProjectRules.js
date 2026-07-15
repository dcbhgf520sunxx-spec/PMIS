function normalizeMemberIds(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
}

function validateProjectStatusChange(status, values = {}) {
  if (Number(status) === 2 && !values.actual_end_date) return '请选择实际完成日期'
  if (Number(status) === 3 && !values.suspend_date) return '请选择暂停日期'
  return null
}

function calculateProjectOverdue(expectedEndDate, status, today = new Date().toISOString().slice(0, 10)) {
  if (!expectedEndDate || [2, 3].includes(Number(status))) return 0
  return String(expectedEndDate).slice(0, 10) < today ? 1 : 0
}

function allowedProjectStatuses(currentStatus) {
  const current = Number(currentStatus)
  if (current === 3) return [0, 1, 2]
  return { 0: [1, 3], 1: [2, 3], 2: [3] }[current] || []
}

module.exports = { normalizeMemberIds, validateProjectStatusChange, calculateProjectOverdue, allowedProjectStatuses }
