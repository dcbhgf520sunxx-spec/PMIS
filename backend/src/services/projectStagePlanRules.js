const { validateActualBusinessDate } = require('./actualBusinessDateRules')

const PLAN_ITEM_STATUS = Object.freeze({
  NOT_STARTED: 0,
  IN_PROGRESS: 1,
  COMPLETED: 2,
  PAUSED: 3,
})

function allowedPlanItemStatuses(status, previousStatus) {
  const value = Number(status)
  if (value === PLAN_ITEM_STATUS.NOT_STARTED) return [PLAN_ITEM_STATUS.IN_PROGRESS, PLAN_ITEM_STATUS.PAUSED]
  if (value === PLAN_ITEM_STATUS.IN_PROGRESS) return [PLAN_ITEM_STATUS.COMPLETED, PLAN_ITEM_STATUS.PAUSED]
  if (value === PLAN_ITEM_STATUS.COMPLETED) return [PLAN_ITEM_STATUS.IN_PROGRESS]
  if (value === PLAN_ITEM_STATUS.PAUSED) return [Number(previousStatus)].filter((item) => [0, 1].includes(item))
  return []
}

function validatePlanItemStatusChange(target, body, requiresDeliveryFile, activeFileCount, today) {
  const value = Number(target)
  if (value === PLAN_ITEM_STATUS.COMPLETED && !body.actual_end_date) return '请填写实际完成时间'
  if (value === PLAN_ITEM_STATUS.COMPLETED && requiresDeliveryFile && Number(activeFileCount) < 1) return '请上传至少一个关键交付文件'
  if (value === PLAN_ITEM_STATUS.COMPLETED) {
    const dateError = validateActualBusinessDate(body.actual_end_date, '实际完成时间', today)
    if (dateError) return dateError
  }
  const pauseReason = String(body.pause_reason || '').trim()
  if (value === PLAN_ITEM_STATUS.PAUSED && !pauseReason) return '请填写暂停原因'
  if (value === PLAN_ITEM_STATUS.PAUSED && pauseReason.length > 200) return '暂停原因不能超过200个字符'
  return null
}

function validatePlanAdjustmentReason(reason) {
  const value = String(reason || '').trim()
  if (!value) return '请填写调整原因'
  if (value.length > 100) return '调整原因不能超过100个字符'
  return null
}

function dateUtc(value) {
  const [year, month, day] = String(value || '').slice(0, 10).split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function getPlanItemProgressHint(item, today = new Date().toISOString().slice(0, 10)) {
  const status = Number(item.status)
  if (status === PLAN_ITEM_STATUS.COMPLETED && item.actual_end_date) {
    return dateUtc(item.actual_end_date) <= dateUtc(item.current_due_date) ? '按期完成' : '延期完成'
  }
  if (![PLAN_ITEM_STATUS.NOT_STARTED, PLAN_ITEM_STATUS.IN_PROGRESS].includes(status) || !item.current_due_date) return null
  const days = Math.round((dateUtc(item.current_due_date) - dateUtc(today)) / 86400000)
  if (days < 0) return `已逾期 ${Math.abs(days)} 天`
  if (days <= 3) return '临近截止'
  return null
}

module.exports = {
  PLAN_ITEM_STATUS,
  allowedPlanItemStatuses,
  validatePlanItemStatusChange,
  validatePlanAdjustmentReason,
  getPlanItemProgressHint,
}
