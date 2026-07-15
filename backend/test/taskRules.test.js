const test = require('node:test')
const assert = require('node:assert/strict')
const {
  allowedTaskStatuses,
  validateTaskStatusChange,
  resolveTaskStatusFields,
  calculateTaskOverdue,
  canCompleteParent,
  canLeaveCompletedSubtask,
} = require('../src/services/taskRules')

test('任务状态流转保持源系统规则', () => {
  assert.deepEqual(allowedTaskStatuses(0), [1, 3])
  assert.deepEqual(allowedTaskStatuses(1), [2, 3])
  assert.deepEqual(allowedTaskStatuses(2), [3])
  assert.deepEqual(allowedTaskStatuses(3, 1), [1])
})

test('完成和暂停要求对应时间', () => {
  assert.equal(validateTaskStatusChange(2, {}), '请填写实际完成时间')
  assert.equal(validateTaskStatusChange(3, {}), '请填写暂停时间')
  assert.equal(validateTaskStatusChange(2, { actual_end_date: '2026-07-13' }), null)
})

test('状态字段按目标状态更新', () => {
  assert.deepEqual(resolveTaskStatusFields({ actual_end_date: '2026-01-01', suspend_date: null }, 3, { suspend_date: '2026-07-13' }), {
    actualEndDate: '2026-01-01', suspendDate: '2026-07-13'
  })
  assert.deepEqual(resolveTaskStatusFields({ actual_end_date: null, suspend_date: '2026-07-13' }, 1, {}), {
    actualEndDate: null, suspendDate: null
  })
})

test('完成或暂停不逾期', () => {
  assert.equal(calculateTaskOverdue('2000-01-01', 2), 0)
  assert.equal(calculateTaskOverdue('2000-01-01', 3), 0)
  assert.equal(calculateTaskOverdue('2999-01-01', 1), 0)
  assert.equal(calculateTaskOverdue('2000-01-01', 1), 1)
})

test('主任务只有在全部子任务完成后才能完成', () => {
  assert.equal(canCompleteParent(2, 3), false)
  assert.equal(canCompleteParent(3, 3), true)
  assert.equal(canCompleteParent(0, 0), true)
})

test('主任务完成后子任务不能离开完成状态', () => {
  assert.equal(canLeaveCompletedSubtask(2), false)
  assert.equal(canLeaveCompletedSubtask(1), true)
  assert.equal(canLeaveCompletedSubtask(3), true)
})
