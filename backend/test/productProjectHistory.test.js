const assert = require('node:assert/strict')
const test = require('node:test')

const { formatHistoryChanges, serializeMemberIds } = require('../src/utils/productProjectHistory')

test('项目历史把字段名、关联 ID 和日期转换为可读内容', () => {
  const changes = formatHistoryChanges([
    { field_name: 'product_id', old_value: '4', new_value: '23' },
    { field_name: 'owner_id', old_value: '1', new_value: '2' },
    { field_name: 'start_date', old_value: '2026-07-11', new_value: '2026-07-12T16:00:00.000Z' },
    { field_name: 'expected_end_date', old_value: '2026-07-25', new_value: '2026-07-25T16:00:00.000Z' },
  ], {
    fieldLabels: { product_id: '所属产品', owner_id: '负责人', start_date: '启动日期', expected_end_date: '预计完成日期' },
    dateFields: new Set(['start_date', 'expected_end_date']),
    valueLookups: {
      product_id: new Map([['4', '旧产品'], ['23', '新产品']]),
      owner_id: new Map([['1', '管理员'], ['2', '孙鑫鑫']]),
    },
  })

  assert.deepEqual(changes, [
    { field_name: '所属产品', old_value: '旧产品', new_value: '新产品' },
    { field_name: '负责人', old_value: '管理员', new_value: '孙鑫鑫' },
    { field_name: '启动日期', old_value: '2026-07-11', new_value: '2026-07-13' },
    { field_name: '预计完成日期', old_value: '2026-07-25', new_value: '2026-07-26' },
  ])
})

test('项目成员日志保存稳定的 ID 数组并展示姓名', () => {
  assert.equal(serializeMemberIds([5, 2, 5]), '[2,5]')
  const changes = formatHistoryChanges([
    { field_name: 'member_ids', old_value: '[1,2]', new_value: '[2,5]' },
  ], {
    fieldLabels: { member_ids: '项目成员' },
    arrayValueLookups: {
      member_ids: new Map([['1', '管理员'], ['2', '孙鑫鑫'], ['5', '张三']]),
    },
  })
  assert.deepEqual(changes, [
    { field_name: '项目成员', old_value: '管理员、孙鑫鑫', new_value: '孙鑫鑫、张三' },
  ])
})
