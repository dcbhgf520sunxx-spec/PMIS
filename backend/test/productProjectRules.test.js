const test = require('node:test')
const assert = require('node:assert/strict')

const {
  normalizeMemberIds,
  validateProjectStatusChange,
  calculateProjectOverdue,
  allowedProjectStatuses,
} = require('../src/services/productProjectRules')

test('normalizeMemberIds removes invalid and duplicate user ids', () => {
  assert.deepEqual(normalizeMemberIds(['2', 2, '3', '', null, 'abc']), [2, 3])
})

test('project status requires completion date when completed', () => {
  assert.equal(validateProjectStatusChange(2, {}), '请选择实际完成日期')
  assert.equal(validateProjectStatusChange(2, { actual_end_date: '2026-07-11' }), null)
})

test('project status requires suspend date when paused', () => {
  assert.equal(validateProjectStatusChange(3, {}), '请选择暂停日期')
  assert.equal(validateProjectStatusChange(3, { suspend_date: '2026-07-11' }), null)
})

test('completed and paused projects are not overdue', () => {
  assert.equal(calculateProjectOverdue('2020-01-01', 2, '2026-07-11'), 0)
  assert.equal(calculateProjectOverdue('2020-01-01', 3, '2026-07-11'), 0)
})

test('active project is overdue after expected end date', () => {
  assert.equal(calculateProjectOverdue('2026-07-10', 1, '2026-07-11'), 1)
  assert.equal(calculateProjectOverdue('2026-07-11', 1, '2026-07-11'), 0)
})

test('project status transitions reject cross-level and restore paused status', () => {
  assert.deepEqual(allowedProjectStatuses(0), [1, 3])
  assert.deepEqual(allowedProjectStatuses(1), [2, 3])
  assert.deepEqual(allowedProjectStatuses(2), [3])
  assert.deepEqual(allowedProjectStatuses(3, 1), [1])
  assert.deepEqual(allowedProjectStatuses(3), [0, 1])
})
