const test = require('node:test')
const assert = require('node:assert/strict')
const {
  allowedBugStatuses,
  validateBugStatusChange,
  resolveBugStatusFields,
} = require('../src/services/bugRules')

test('BUG 状态流转保持源系统规则', () => {
  assert.deepEqual(allowedBugStatuses(0), [1, 2])
  assert.deepEqual(allowedBugStatuses(1), [2, 3])
  assert.deepEqual(allowedBugStatuses(2), [3])
  assert.deepEqual(allowedBugStatuses(3), [1])
})

test('已修复和已关闭要求对应处理信息', () => {
  assert.equal(validateBugStatusChange(1, {}), '请填写修复时间')
  assert.equal(validateBugStatusChange(1, { resolved_date: '2026-07-13' }), '请选择解决方案')
  assert.equal(validateBugStatusChange(1, { resolved_date: '2026-07-13', resolution_id: 1 }), null)
  assert.equal(validateBugStatusChange(2, {}), '请填写关闭时间')
  assert.equal(validateBugStatusChange(2, { closed_date: '2026-07-13' }), null)
  assert.equal(validateBugStatusChange(3, {}), '请填写激活原因')
  assert.equal(validateBugStatusChange(3, { activation_reason: '   ' }), '请填写激活原因')
  assert.equal(validateBugStatusChange(3, { activation_reason: 'a'.repeat(101) }), '激活原因不能超过100字')
  assert.equal(validateBugStatusChange(3, { activation_reason: ' 问题再次复现 ' }), null)
})

test('BUG 激活时保留原修复信息和激活原因', () => {
  const old = { resolved_date: '2026-07-12', closed_date: '2026-07-13', resolution_id: 9, activation_reason: '旧激活原因' }
  assert.deepEqual(resolveBugStatusFields(old, 3, { activation_reason: ' 问题再次复现 ' }), {
    resolvedDate: '2026-07-12',
    closedDate: null,
    resolutionId: 9,
    activationReason: '问题再次复现',
  })
  assert.deepEqual(resolveBugStatusFields(old, 2, { closed_date: '2026-07-14' }), {
    resolvedDate: '2026-07-12',
    closedDate: '2026-07-14',
    resolutionId: 9,
    activationReason: '旧激活原因',
  })
  assert.deepEqual(resolveBugStatusFields(old, 1, { resolved_date: '2026-07-15', resolution_id: 3 }), {
    resolvedDate: '2026-07-15',
    closedDate: null,
    resolutionId: 3,
    activationReason: '旧激活原因',
  })
})
