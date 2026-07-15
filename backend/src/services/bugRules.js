function allowedBugStatuses(status) {
  return { 0: [1, 2], 1: [2, 3], 2: [3], 3: [1] }[Number(status)] || []
}

function validateBugStatusChange(target, body = {}) {
  if (Number(target) === 1 && !body.resolved_date) return '请填写修复时间'
  if (Number(target) === 1 && !body.resolution_id) return '请选择解决方案'
  if (Number(target) === 2 && !body.closed_date) return '请填写关闭时间'
  if (Number(target) === 3 && !String(body.activation_reason || '').trim()) return '请填写激活原因'
  if (Number(target) === 3 && String(body.activation_reason).trim().length > 100) return '激活原因不能超过100字'
  return null
}

function resolveBugStatusFields(old, target, body = {}) {
  const status = Number(target)
  if (status === 1) {
    return {
      resolvedDate: body.resolved_date,
      closedDate: null,
      resolutionId: Number(body.resolution_id),
      activationReason: old.activation_reason || null,
    }
  }
  if (status === 2) {
    return {
      resolvedDate: old.resolved_date || null,
      closedDate: body.closed_date,
      resolutionId: old.resolution_id || null,
      activationReason: old.activation_reason || null,
    }
  }
  return {
    resolvedDate: status === 3 ? old.resolved_date || null : null,
    closedDate: null,
    resolutionId: status === 3 ? old.resolution_id || null : null,
    activationReason: status === 3 ? String(body.activation_reason).trim() : null,
  }
}

module.exports = { allowedBugStatuses, validateBugStatusChange, resolveBugStatusFields }
