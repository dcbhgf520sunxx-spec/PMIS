const { validateActualBusinessDate } = require('./actualBusinessDateRules')
const { BUSINESS_FIELD_LIMITS } = require('./businessFieldRules')

function allowedTaskStatuses(status) {
  if (Number(status) === 3) return [0, 1, 2]
  return { 0: [1, 3], 1: [2, 3], 2: [3] }[Number(status)] || []
}

function validateTaskStatusChange(target, body = {}, today) {
  if (Number(target) === 2 && !body.actual_end_date) return '请填写实际完成时间'
  if (Number(target) === 3 && !body.suspend_date) return '请填写暂停时间'
  if (Number(target) === 3 && !String(body.suspend_reason || '').trim()) return '请填写暂停原因'
  if (Number(target) === 3 && String(body.suspend_reason || '').trim().length > BUSINESS_FIELD_LIMITS.pauseReason) return `暂停原因最多${BUSINESS_FIELD_LIMITS.pauseReason}字符`
  return Number(target) === 2
    ? validateActualBusinessDate(body.actual_end_date, '实际完成时间', today)
    : null
}

function resolveTaskStatusFields(old, target, body = {}) {
  const status = Number(target)
  return {
    actualEndDate: status === 2
      ? body.actual_end_date
      : Number(old.status) === 2 && status === 3
        ? old.actual_end_date || null
        : null,
    suspendDate: status === 3 ? body.suspend_date : null,
    suspendReason: status === 3 ? String(body.suspend_reason || '').trim() : null,
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

function validateSubtaskParent(parent) {
  if (parent?.parent_task_id) return '父任务必须是主任务'
  if (Number(parent?.status) === 2) return '已完成的主任务不能新增子任务'
  return null
}

module.exports = { allowedTaskStatuses, validateTaskStatusChange, resolveTaskStatusFields, calculateTaskOverdue, canCompleteParent, canLeaveCompletedSubtask, validateSubtaskParent }
