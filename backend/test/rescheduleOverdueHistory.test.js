const test = require('node:test')
const assert = require('node:assert/strict')
const { rescheduleOverdueChanges } = require('../src/services/overdueRules')

const today = '2026-11-13'
const active = { id: 1, status: 1, expected_end_date: '2026-11-10', is_overdue: 0 }
const snapshot = [{ field: 'reschedule_overdue_days', oldVal: null, newVal: '3天' }]

test('改期前逾期天数取修改前日期与状态，不依赖缓存或新计划', async () => {
  for (const type of ['project', 'task']) {
    assert.deepEqual(await rescheduleOverdueChanges(type, active, '2026-11-20', null, today), snapshot)
    assert.deepEqual(await rescheduleOverdueChanges(type, active, '2026-11-09', null, today), snapshot)
  }
  assert.deepEqual(await rescheduleOverdueChanges('work_order', { status: 1, expected_resolve_date: '2026-11-10T15:00:00Z' }, '2026-11-20', null, today), snapshot)
  assert.deepEqual(await rescheduleOverdueChanges('stage_plan', { status: 1, current_due_date: '2026-11-10', parent_project_status: 1 }, '2026-11-20', null, today), snapshot)
})

test('未改日期、同一上海日期、无原日期、未到期和到期当天不生成逾期明细', async () => {
  for (const [old, next] of [[active, '2026-11-10'], [{ ...active, expected_end_date: null }, '2026-11-20'], [{ ...active, expected_end_date: '2026-11-13' }, '2026-11-20'], [{ ...active, expected_end_date: '2026-11-15', is_overdue: 1 }, '2026-11-20']]) {
    assert.deepEqual(await rescheduleOverdueChanges('task', old, next, null, today), [])
  }
  assert.deepEqual(await rescheduleOverdueChanges('work_order', { status: 1, expected_resolve_date: '2026-11-10T16:00:00Z' }, '2026-11-11', null, today), [])
})

test('完成、暂停、关闭以及父项目暂停或关闭沿用原逾期规则', async () => {
  for (const type of ['project', 'task']) for (const status of [2, 3, 4]) {
    assert.deepEqual(await rescheduleOverdueChanges(type, { ...active, status }, '2026-11-20', null, today), [])
  }
  for (const status of [2, 3, 4]) assert.deepEqual(await rescheduleOverdueChanges('work_order', { status, expected_resolve_date: '2026-11-10' }, '2026-11-20', null, today), [])
  for (const parent_project_status of [3, 4]) assert.deepEqual(await rescheduleOverdueChanges('stage_plan', { status: 1, current_due_date: '2026-11-10', parent_project_status }, '2026-11-20', null, today), [])
})

test('需求按修改前本轮完成结论判断；已完成与证据不足不伪造逾期', async () => {
  assert.deepEqual(await rescheduleOverdueChanges('requirement', { ...active, requirement_type: 4, status: 31 }, '2026-11-20', null, today), snapshot)
  assert.deepEqual(await rescheduleOverdueChanges('requirement', { ...active, requirement_type: 4, status: 35 }, '2026-11-20', null, today), snapshot)
  for (const status of [33, 34, 36, 37]) assert.deepEqual(await rescheduleOverdueChanges('requirement', { ...active, requirement_type: 4, status }, '2026-11-20', null, today), [])
  for (const completed of [true, null, false]) {
    const database = { prepare: () => ({ get: async () => ({ completed }) }) }
    assert.deepEqual(await rescheduleOverdueChanges('requirement', { ...active, requirement_type: 1, status: 31 }, '2026-11-20', database, today), completed === false ? snapshot : [])
  }
})
