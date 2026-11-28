const test = require('node:test')
const assert = require('node:assert/strict')
const { parseNeighborIds, neighborPosition } = require('../src/utils/recordNeighbors')

test('批量定位只接受安全正整数，去重并优先使用 ids', () => {
  assert.deepEqual(parseNeighborIds({ id: '9', ids: '3, 2,3' }), [3, 2])
  assert.deepEqual(parseNeighborIds({ id: '9' }), [9])
  for (const ids of ['', '1,,2', '-1', '0', '1.5', '9007199254740992', ['1', '2']]) assert.equal(parseNeighborIds({ id: '9', ids }), null)
})

test('定位新增 id/page 保持原有相邻 ID 和各模块计数类型', () => {
  const row = { id: '8', prevId: '7', nextId: '9', ordinal: '8', total: '12', page_ordinal: '3' }
  assert.deepEqual(neighborPosition(row, 2), { id: 8, prevId: '7', nextId: '9', ordinal: 8, total: 12, page: 2 })
  assert.deepEqual(neighborPosition(row, 2, false), { id: 8, prevId: '7', nextId: '9', ordinal: '8', total: '12', page: 2 })
  assert.deepEqual(neighborPosition(undefined, 2), { id: null, prevId: null, nextId: null, total: 0, page: 1 })
})
