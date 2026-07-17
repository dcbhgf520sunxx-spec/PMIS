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

test('任务暂停后可以恢复到任意其他状态', () => {
  assert.deepEqual(allowedTaskStatuses(0), [1, 3])
  assert.deepEqual(allowedTaskStatuses(1), [2, 3])
  assert.deepEqual(allowedTaskStatuses(2), [3])
  assert.deepEqual(allowedTaskStatuses(3, 1), [0, 1, 2])
})

test('完成和暂停要求对应时间', () => {
  assert.equal(validateTaskStatusChange(2, {}), '请填写实际完成时间')
  assert.equal(validateTaskStatusChange(3, {}), '请填写暂停时间')
  assert.equal(validateTaskStatusChange(2, { actual_end_date: '2026-07-13' }), null)
})

test('暂停任务恢复时按目标状态清理时间字段', () => {
  assert.deepEqual(resolveTaskStatusFields({ status: 2, actual_end_date: '2026-01-01', suspend_date: null }, 3, { suspend_date: '2026-07-13' }), {
    actualEndDate: '2026-01-01', suspendDate: '2026-07-13'
  })
  const paused = { status: 3, actual_end_date: '2026-01-01', suspend_date: '2026-07-13' }
  assert.deepEqual(resolveTaskStatusFields(paused, 1, {}), {
    actualEndDate: null, suspendDate: null
  })
  assert.deepEqual(resolveTaskStatusFields(paused, 2, { actual_end_date: '2026-07-14' }), {
    actualEndDate: '2026-07-14', suspendDate: null
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
