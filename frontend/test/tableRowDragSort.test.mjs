import assert from 'node:assert/strict';
import test from 'node:test';

import { moveTableRow } from '../src/components/admin/SearchTable/rowDragSort.ts';

const rows = [
  { id: 'a', name: '档案一' },
  { id: 'b', name: '档案二' },
  { id: 'c', name: '档案三' }
];

test('向后拖动表格行时按目标行位置生成新顺序且不修改原数组', () => {
  const nextRows = moveTableRow(rows, 'a', 'c', (row) => row.id);

  assert.deepEqual(nextRows.map((row) => row.id), ['b', 'c', 'a']);
  assert.deepEqual(rows.map((row) => row.id), ['a', 'b', 'c']);
});

test('向前拖动表格行时按目标行位置生成新顺序', () => {
  const nextRows = moveTableRow(rows, 'c', 'a', (row) => row.id);

  assert.deepEqual(nextRows.map((row) => row.id), ['c', 'a', 'b']);
});

test('拖到自身或找不到目标行时保持原顺序', () => {
  assert.equal(moveTableRow(rows, 'b', 'b', (row) => row.id), rows);
  assert.equal(moveTableRow(rows, 'b', 'missing', (row) => row.id), rows);
});
