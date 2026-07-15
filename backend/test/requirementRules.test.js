const test = require('node:test')
const assert = require('node:assert/strict')
const { initialRequirementStatus, allowedRequirementStatuses, validateRequirementStatusChange, calculateRequirementOverdue, resolveRequirementStatusFields, resolveRequirementTypeChange } = require('../src/services/requirementRules')

test('each requirement path has the expected initial status', () => {
  assert.deepEqual([1, 2, 3, 4].map(initialRequirementStatus), [0, 10, 20, 30])
})

test('requirement transitions preserve path approval and common delivery stages', () => {
  assert.deepEqual(allowedRequirementStatuses(1, 0), [1, 35])
  assert.deepEqual(allowedRequirementStatuses(2, 11), [12, 13, 35])
  assert.deepEqual(allowedRequirementStatuses(3, 21), [30, 35])
  assert.deepEqual(allowedRequirementStatuses(4, 30), [31, 35])
  assert.deepEqual(allowedRequirementStatuses(1, 32), [33, 34, 35])
  assert.deepEqual(allowedRequirementStatuses(1, 35), [0, 1, 2, 3, 30, 31, 32, 33, 34])
  assert.deepEqual(allowedRequirementStatuses(2, 35), [10, 11, 12, 13, 30, 31, 32, 33, 34])
  assert.deepEqual(allowedRequirementStatuses(3, 35), [20, 21, 22, 30, 31, 32, 33, 34])
  assert.deepEqual(allowedRequirementStatuses(4, 35), [30, 31, 32, 33, 34])
})

test('completion and pause require their business fields', () => {
  assert.equal(validateRequirementStatusChange(33, {}), '请选择实际完成时间')
  assert.equal(validateRequirementStatusChange(33, { actual_end_date: '2026-07-12' }), '请输入完成情况')
  assert.equal(validateRequirementStatusChange(35, {}), '请选择暂停时间')
  assert.equal(validateRequirementStatusChange(34, { actual_end_date: '2026-07-12', completion_status: '未投入使用' }), null)
})

test('pause preserves completion fields and restoring follows project field rules', () => {
  const completed = { status: 33, actual_end_date: '2026-07-12', completion_status: '已交付', pause_date: null }
  assert.deepEqual(resolveRequirementStatusFields(completed, 35, { pause_date: '2026-07-13' }), {
    actualEndDate: '2026-07-12', completionStatus: '已交付', pauseDate: '2026-07-13'
  })
  const paused = { status: 35, actual_end_date: '2026-07-12', completion_status: '已交付', pause_date: '2026-07-13' }
  assert.deepEqual(resolveRequirementStatusFields(paused, 31, {}), {
    actualEndDate: null, completionStatus: null, pauseDate: null
  })
  assert.deepEqual(resolveRequirementStatusFields(paused, 34, { actual_end_date: '2026-07-14', completion_status: '未使用' }), {
    actualEndDate: '2026-07-14', completionStatus: '未使用', pauseDate: null
  })
})

test('changing requirement path resets pre-delivery status and locks delivery stages', () => {
  assert.deepEqual(resolveRequirementTypeChange(3, 20, 4), { allowed: true, status: 30 })
  assert.deepEqual(resolveRequirementTypeChange(1, 1, 2), { allowed: true, status: 10 })
  assert.deepEqual(resolveRequirementTypeChange(4, 31, 1), { allowed: false, status: 31 })
  assert.deepEqual(resolveRequirementTypeChange(2, 35, 3), { allowed: false, status: 35 })
  assert.deepEqual(resolveRequirementTypeChange(4, 30, 4), { allowed: true, status: 30 })
})

test('terminal requirement statuses do not carry overdue state', () => {
  assert.equal(calculateRequirementOverdue('2020-01-01', 33, '2026-07-12'), null)
  assert.equal(calculateRequirementOverdue('2020-01-01', 35, '2026-07-12'), null)
  assert.equal(calculateRequirementOverdue('2026-07-11', 31, '2026-07-12'), 1)
  assert.equal(calculateRequirementOverdue('2026-07-12', 31, '2026-07-12'), 0)
})
