import test from 'node:test';
import assert from 'node:assert/strict';
import { groupRecentUpdates } from '../src/modules/digital-twin/components/groupRecentUpdates.ts';

test('同类更新合并为一组，保留各类首次出现顺序与组内时间顺序', () => {
  const records = [
    { kind: 'orders', id: 'new', updatedAt: '2026-10-10' },
    { kind: 'projects', id: 'project', updatedAt: '2026-10-09' },
    { kind: 'orders', id: 'old', updatedAt: '2026-10-08' },
    { kind: 'tasks', id: 'task', updatedAt: '2026-10-07' }
  ];
  assert.deepEqual(groupRecentUpdates(records).map(group => [group.kind, group.records.map(record => record.id)]), [
    ['orders', ['new', 'old']], ['projects', ['project']], ['tasks', ['task']]
  ]);
  assert.deepEqual(records.map(record => record.id), ['new', 'project', 'old', 'task']);
});

test('没有更新时不生成空分类', () => {
  assert.deepEqual(groupRecentUpdates([]), []);
});
