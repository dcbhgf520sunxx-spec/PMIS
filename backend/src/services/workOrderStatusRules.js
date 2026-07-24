const WORK_ORDER_STATUS_TRANSITIONS = {
  0: [1, 4],
  1: [2, 4],
  2: [3, 4, 5],
  3: [4, 5],
  4: [0, 1, 2, 3],
  5: [2]
}

function allowedWorkOrderStatuses(status) {
  return WORK_ORDER_STATUS_TRANSITIONS[Number(status)] || []
}

function resolveWorkOrderResultFields(status, body = {}, old = {}) {
  const target = Number(status)
  if (target === 5) {
    return {
      resolveDate: old.resolve_date || null,
      closeDate: null,
      resultDesc: old.result_desc || null,
      suspendDate: null,
      activationReason: String(body.activation_reason || '').trim()
    }
  }
  if (target === 4) {
    return {
      resolveDate: old.resolve_date || null,
      closeDate: old.close_date || null,
      resultDesc: old.result_desc || null,
      suspendDate: body.suspend_date || null
    }
  }
  if (target === 2) {
    return {
      resolveDate: body.resolve_date || null,
      closeDate: null,
      resultDesc: body.result_desc ? String(body.result_desc).trim() : null,
      suspendDate: null
    }
  }
  if (target === 3) {
    return {
      resolveDate: body.resolve_date || old.resolve_date || null,
      closeDate: body.close_date || null,
      resultDesc: body.result_desc ? String(body.result_desc).trim() : (old.result_desc || null),
      suspendDate: null
    }
  }
  return { resolveDate: null, closeDate: null, resultDesc: null, suspendDate: null }
}

function validateWorkOrderResultFields(status, values) {
  const target = Number(status)
  if (target === 5 && !values.activationReason) return '激活工单时必须填写激活原因'
  if (target === 5 && values.activationReason.length > 100) return '激活原因不能超过100字'
  if (target === 2 && (!values.resolveDate || !values.resultDesc)) {
    return '标记为已解决时必须填写实际修复时间和处置结果'
  }
  if (target === 3 && (!values.resolveDate || !values.resultDesc)) {
    return '关闭工单时必须填写实际修复时间和处置结果'
  }
  if (target === 3 && !values.closeDate) return '关闭工单时必须填写关闭时间'
  if (target === 4 && !values.suspendDate) return '暂停工单时必须填写暂停时间'
  return ''
}

function resolveWorkOrderActivationReason(status, body = {}, old = {}) {
  const target = Number(status)
  if (target === 0 || target === 1) return null
  if (target === 5) return String(body.activation_reason || '').trim()
  return old.activation_reason || null
}

module.exports = {
  WORK_ORDER_STATUS_TRANSITIONS,
  allowedWorkOrderStatuses,
  resolveWorkOrderResultFields,
  resolveWorkOrderActivationReason,
  validateWorkOrderResultFields
}
