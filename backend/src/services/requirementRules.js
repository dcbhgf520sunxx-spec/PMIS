const TERMINAL = new Set([3, 13, 22, 33, 34, 35])
const TRANSITIONS = {
  '1_0': [1, 35], '1_1': [2, 3, 35], '1_2': [30, 35], '1_3': [0, 35],
  '2_10': [11, 35], '2_11': [12, 13, 35], '2_12': [30, 35], '2_13': [10, 35],
  '3_20': [21, 22, 35], '3_21': [30, 35], '3_22': [35], '4_30': [31, 35],
  '_30': [31, 35], '_31': [32, 35], '_32': [33, 34, 35], '_33': [34, 35], '_34': [33, 35],
}
const PATH_STATUSES = {
  1: [0, 1, 2, 3, 30, 31, 32, 33, 34],
  2: [10, 11, 12, 13, 30, 31, 32, 33, 34],
  3: [20, 21, 22, 30, 31, 32, 33, 34],
  4: [30, 31, 32, 33, 34],
}
function initialRequirementStatus(type) { return ({ 1: 0, 2: 10, 3: 20, 4: 30 })[Number(type)] }
function resolveRequirementTypeChange(oldType, oldStatus, nextType) {
  if (Number(oldType) === Number(nextType)) return { allowed: true, status: Number(oldStatus) }
  if ([30, 31, 32, 33, 34, 35].includes(Number(oldStatus))) return { allowed: false, status: Number(oldStatus) }
  return { allowed: true, status: initialRequirementStatus(nextType) }
}
function allowedRequirementStatuses(type, current, _previous) {
  if (Number(current) === 35) return PATH_STATUSES[Number(type)] || []
  return TRANSITIONS[`${Number(type)}_${Number(current)}`] || TRANSITIONS[`_${Number(current)}`] || []
}
function validateRequirementStatusChange(status, values = {}) {
  if ([33, 34].includes(Number(status)) && !values.actual_end_date) return '请选择实际完成时间'
  if ([33, 34].includes(Number(status)) && !String(values.completion_status || '').trim()) return '请输入完成情况'
  if (Number(status) === 35 && !values.pause_date) return '请选择暂停时间'
  return null
}
function resolveRequirementStatusFields(old, target, values = {}) {
  const completed = [33, 34].includes(Number(target))
  const preserveCompleted = [33, 34].includes(Number(old.status)) && Number(target) === 35
  return {
    actualEndDate: completed ? values.actual_end_date : preserveCompleted ? old.actual_end_date : null,
    completionStatus: completed ? values.completion_status : preserveCompleted ? old.completion_status : null,
    pauseDate: Number(target) === 35 ? values.pause_date : null,
  }
}
function calculateRequirementOverdue(date, status, today = new Date().toISOString().slice(0, 10)) {
  if (TERMINAL.has(Number(status))) return null
  if (!date) return 0
  return String(date).slice(0, 10) < today ? 1 : 0
}
module.exports = { TERMINAL, initialRequirementStatus, resolveRequirementTypeChange, allowedRequirementStatuses, validateRequirementStatusChange, resolveRequirementStatusFields, calculateRequirementOverdue }
