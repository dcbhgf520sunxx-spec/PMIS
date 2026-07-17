function allowedTaskStatuses(status) {
  if (Number(status) === 3) return [0, 1, 2]
  return { 0: [1, 3], 1: [2, 3], 2: [3] }[Number(status)] || []
}

function validateTaskStatusChange(target, body = {}) {
  if (Number(target) === 2 && !body.actual_end_date) return '请填写实际完成时间'
  if (Number(target) === 3 && !body.suspend_date) return '请填写暂停时间'
  return null
}

function resolveTaskStatusFields(old, target, body = {}) {
  const status = Number(target)
  return {
    actualEndDate: status === 2 ? body.actual_end_date : old.actual_end_date || null,
    suspendDate: status === 3 ? body.suspend_date : null,
  }
}

function calculateTaskOverdue(expectedEndDate, status) {
  if (!expectedEndDate || [2, 3].includes(Number(status))) return 0
  const today = new Date().toISOString().slice(0, 10)
  return String(expectedEndDate).slice(0, 10) < today ? 1 : 0
}

function canCompleteParent(completed, total) {
  return Number(completed) === Number(total)
}

function canLeaveCompletedSubtask(parentStatus) {
  return Number(parentStatus) !== 2
}

module.exports = { allowedTaskStatuses, validateTaskStatusChange, resolveTaskStatusFields, calculateTaskOverdue, canCompleteParent, canLeaveCompletedSubtask }
