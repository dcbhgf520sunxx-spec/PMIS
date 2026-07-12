const assert = require('node:assert/strict')
const test = require('node:test')

const { groupOperationLogs } = require('../src/utils/operationHistory')

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
