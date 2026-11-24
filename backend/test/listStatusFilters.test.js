const assert = require('node:assert/strict')
const test = require('node:test')
const { numberListCondition } = require('../src/utils/listFilters')

test('状态并集保留0、兼容单值/数组、去重且忽略空项', () => {
  assert.deepEqual(numberListCondition('t.status', '0,1,1,,2'), { sql: ' AND t.status IN (?,?,?)', params: [0, 1, 2] })
  assert.deepEqual(numberListCondition('t.status', 0), { sql: ' AND t.status IN (?)', params: [0] })
  assert.deepEqual(numberListCondition('t.status', [0, 2]), { sql: ' AND t.status IN (?,?)', params: [0, 2] })
  for (const value of [null, undefined, '', [], ' , ']) assert.deepEqual(numberListCondition('t.status', value), { sql: '', params: [] })
})

test('非法状态不拼入SQL，也不会意外扩大查询范围', () => {
  for (const value of ['1 OR 1=1', '1,NaN', '1,Infinity', '0,1.5']) {
    assert.deepEqual(numberListCondition('t.status', value), { sql: ' AND 1=0', params: [] })
  }
})
