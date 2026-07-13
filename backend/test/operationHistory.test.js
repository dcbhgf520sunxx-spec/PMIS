const assert = require('node:assert/strict')
const test = require('node:test')

const { formatHistoryChanges, groupOperationLogs } = require('../src/utils/operationHistory')

test('同一次操作按 operation_id 聚合且字段遵循详情顺序', () => {
  const logs = [
    { id: 3, operation_id: 'op-1', field_name: 'status', created_at: '2026-07-12 10:00:00' },
    { id: 2, operation_id: 'op-1', field_name: 'problem_desc', created_at: '2026-07-12 10:00:00' },
    { id: 1, operation_id: 'op-1', field_name: 'follower_id', created_at: '2026-07-12 10:00:00' }
  ]

  const groups = groupOperationLogs(logs, ['problem_desc', 'status', 'follower_id'])

  assert.equal(groups.length, 1)
  assert.deepEqual(groups[0].changes.map((item) => item.field_name), ['problem_desc', 'status', 'follower_id'])
})

test('旧日志没有 operation_id 时不按同秒误聚合', () => {
  const logs = [
    { id: 2, operation_id: null, user_id: 1, action: '编辑', field_name: 'name', created_at: '2026-07-12 10:00:00' },
    { id: 1, operation_id: null, user_id: 1, action: '编辑', field_name: 'status', created_at: '2026-07-12 10:00:00' }
  ]

  assert.equal(groupOperationLogs(logs, ['name', 'status']).length, 2)
})

test('历史明细统一转成中文字段名和业务展示值', () => {
  const changes = formatHistoryChanges([
    { field_name: 'owner_id', old_value: '2', new_value: '3' },
    { field_name: 'reviewer_id', old_value: '9', new_value: '10' },
    { field_name: 'internal_code', old_value: 'A', new_value: 'B' },
    { field_name: 'priority', old_value: '2', new_value: '1' },
    { field_name: 'expected_end_date', old_value: '2026-07-09T00:00:00.000Z', new_value: '2026-07-15' }
  ], {
    fieldLabels: { owner_id: '负责人', reviewer_id: '审核人', priority: '优先级', expected_end_date: '预计完成时间' },
    dateFields: new Set(['expected_end_date']),
    valueLookups: {
      owner_id: new Map([['2', '张三'], ['3', '李四']]),
      reviewer_id: new Map(),
      priority: new Map([['1', '中'], ['2', '高']])
    }
  })

  assert.deepEqual(changes, [
    { field_name: '负责人', old_value: '张三', new_value: '李四' },
    { field_name: '审核人', old_value: '-', new_value: '-' },
    { field_name: '其他字段', old_value: 'A', new_value: 'B' },
    { field_name: '优先级', old_value: '高', new_value: '中' },
    { field_name: '预计完成时间', old_value: '2026-07-09', new_value: '2026-07-15' }
  ])
})
