const assert = require('node:assert/strict')
const test = require('node:test')

const {
  appendLegacyAdjustmentReasons,
  buildPlanItemStatusHistoryChanges,
  buildProjectStagePlanHistory,
  resolveMovedPlanRow,
} = require('../src/services/projectStagePlanHistory')

test('阶段主计划历史使用动作和对象名称作为标题并隐藏新增删除明细', () => {
  const rows = buildProjectStagePlanHistory([
    { id: 3, action: '删除关键事项', target_name: '启动会', field_name: 'is_deleted', old_value: '0', new_value: '1', created_at: '2026-07-26 10:00:00', operator: '孙鑫鑫' },
    { id: 2, action: '新增阶段', target_name: '项目启动', field_name: null, old_value: null, new_value: '项目启动', created_at: '2026-07-26 09:00:00', operator: '孙鑫鑫' },
  ])

  assert.deepEqual(rows.map((row) => ({ action: row.action, changes: row.changes })), [
    { action: '删除关键事项 · 启动会', changes: [] },
    { action: '新增阶段 · 项目启动', changes: [] },
  ])
})

test('阶段主计划历史只展示真实变化并转译状态人员和阶段', () => {
  const rows = buildProjectStagePlanHistory([
    { id: 4, operation_id: 'edit-1', action: '编辑关键事项', target_name: '启动会', field_name: 'stage_id', old_value: '1', new_value: '2', created_at: '2026-07-26 10:00:00', operator: '孙鑫鑫' },
    { id: 3, operation_id: 'edit-1', action: '编辑关键事项', target_name: '启动会', field_name: 'owner_id', old_value: '8', new_value: '9', created_at: '2026-07-26 10:00:00', operator: '孙鑫鑫' },
    { id: 2, operation_id: 'edit-1', action: '编辑关键事项', target_name: '启动会', field_name: 'name', old_value: '启动会', new_value: '启动会', created_at: '2026-07-26 10:00:00', operator: '孙鑫鑫' },
  ], {
    stageLookup: new Map([['1', '项目启动'], ['2', '蓝图设计']]),
    userLookup: new Map([['8', '孙鑫鑫'], ['9', '钱敏']]),
  })

  assert.deepEqual(rows[0].changes, [
    { field_name: '所属阶段', old_value: '项目启动', new_value: '蓝图设计' },
    { field_name: '负责人', old_value: '孙鑫鑫', new_value: '钱敏' },
  ])
})

test('调整计划展示完成时间和调整原因，状态变更展示中文状态', () => {
  const rows = buildProjectStagePlanHistory([
    { id: 4, operation_id: 'adjust-1', action: '调整计划', target_name: '启动会', field_name: 'current_due_date', old_value: '2026-07-30', new_value: '2026-08-01', created_at: '2026-07-26 10:00:00', operator: '孙鑫鑫' },
    { id: 3, operation_id: 'adjust-1', action: '调整计划', target_name: '启动会', field_name: 'adjustment_reason', old_value: null, new_value: '等待客户确认', created_at: '2026-07-26 10:00:00', operator: '孙鑫鑫' },
    { id: 2, operation_id: 'status-1', action: '状态变更', target_name: '启动会', field_name: 'status', old_value: '1', new_value: '3', created_at: '2026-07-26 09:00:00', operator: '孙鑫鑫' },
    { id: 1, operation_id: 'status-1', action: '状态变更', target_name: '启动会', field_name: 'pause_reason', old_value: null, new_value: '等待客户确认', created_at: '2026-07-26 09:00:00', operator: '孙鑫鑫' },
  ])

  assert.deepEqual(rows[0].changes, [
    { field_name: '计划完成时间', old_value: '2026-07-30', new_value: '2026-08-01' },
    { field_name: '调整原因', old_value: '', new_value: '等待客户确认' },
  ])
  assert.deepEqual(rows[1].changes, [
    { field_name: '状态', old_value: '进行中', new_value: '已暂停' },
    { field_name: '暂停原因', old_value: '', new_value: '等待客户确认' },
  ])
})

test('完成状态随附交付文件时归入同一条状态变更明细', () => {
  const rows = buildProjectStagePlanHistory([
    { id: 3, operation_id: 'status-with-files', action: '状态变更', target_name: '试运行报告', field_name: 'status', old_value: '1', new_value: '2', created_at: '2026-07-29 16:45:12', operator: '孙鑫鑫' },
    { id: 2, operation_id: 'status-with-files', action: '状态变更', target_name: '试运行报告', field_name: 'actual_end_date', old_value: null, new_value: '2026-07-29', created_at: '2026-07-29 16:45:12', operator: '孙鑫鑫' },
    { id: 1, operation_id: 'status-with-files', action: '状态变更', target_name: '试运行报告', field_name: 'delivery_files', old_value: null, new_value: '试运行报告.pdf、验收清单.xlsx', created_at: '2026-07-29 16:45:12', operator: '孙鑫鑫' },
  ])

  assert.equal(rows.length, 1)
  assert.equal(rows[0].action, '状态变更 · 试运行报告')
  assert.deepEqual(rows[0].changes, [
    { field_name: '状态', old_value: '进行中', new_value: '已完成' },
    { field_name: '实际完成时间', old_value: '', new_value: '2026-07-29' },
    { field_name: '交付文件', old_value: '', new_value: '试运行报告.pdf、验收清单.xlsx' },
  ])
})

test('完成后单独补传交付文件保留独立记录且文件名位于明细', () => {
  const rows = buildProjectStagePlanHistory([
    { id: 1, action: '上传交付文件', target_name: '试运行报告', field_name: 'delivery_files', old_value: null, new_value: '补充说明.pdf', created_at: '2026-07-29 17:00:00', operator: '孙鑫鑫' },
  ])

  assert.equal(rows[0].action, '上传交付文件 · 试运行报告')
  assert.deepEqual(rows[0].changes, [
    { field_name: '交付文件', old_value: '', new_value: '补充说明.pdf' },
  ])
})

test('状态变更日志包含随状态提交的交付文件名', () => {
  assert.deepEqual(buildPlanItemStatusHistoryChanges({
    status: 1,
    actual_end_date: null,
    pause_reason: null,
  }, 2, '2026-07-29', null, ['试运行报告.pdf', '验收清单.xlsx']), [
    { field: 'status', oldVal: 1, newVal: 2 },
    { field: 'actual_end_date', oldVal: null, newVal: '2026-07-29' },
    { field: 'pause_reason', oldVal: null, newVal: null },
    { field: 'delivery_files', oldVal: null, newVal: '试运行报告.pdf、验收清单.xlsx' },
  ])
})

test('排序只返回真正移动的阶段或关键事项及前后位置', () => {
  const rows = [
    { id: 10, name: '第一项', sort_order: 0 },
    { id: 20, name: '第二项', sort_order: 1 },
    { id: 30, name: '第三项', sort_order: 2 },
  ]

  assert.deepEqual(resolveMovedPlanRow(rows, [20, 30, 10], 10), {
    id: 10,
    name: '第一项',
    oldPosition: 1,
    newPosition: 3,
  })
  assert.equal(resolveMovedPlanRow(rows, [10, 20, 30], 10), null)
})

test('旧调整日志从调整记录补回原因并保持同一操作聚合', () => {
  const logs = appendLegacyAdjustmentReasons([
    { id: 8, operation_id: null, action: '调整计划', target_id: 20, target_name: '启动会', field_name: 'current_due_date', old_value: '2026-07-30', new_value: '2026-08-01', created_at: '2026-07-26 10:00:01', operator: '孙鑫鑫' },
  ], [
    { plan_item_id: 20, new_due_date: '2026-08-01', reason: '等待客户确认', created_at: '2026-07-26 10:00:00' },
  ])

  const rows = buildProjectStagePlanHistory(logs)
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].changes, [
    { field_name: '计划完成时间', old_value: '2026-07-30', new_value: '2026-08-01' },
    { field_name: '调整原因', old_value: '', new_value: '等待客户确认' },
  ])
})
