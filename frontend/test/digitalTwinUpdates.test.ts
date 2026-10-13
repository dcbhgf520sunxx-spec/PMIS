import test from 'node:test';
import assert from 'node:assert/strict';
import { groupRecentUpdates } from '../src/modules/digital-twin/components/groupRecentUpdates.ts';
import { kindNames } from '../src/modules/digital-twin/types.ts';

test('同类更新按菜单顺序合并，保留组内时间顺序和原始记录', () => {
  const records = [
    { kind: 'orders', id: 'new', updatedAt: '2026-10-10' },
    { kind: 'projects', id: 'project', updatedAt: '2026-10-09' },
    { kind: 'orders', id: 'old', updatedAt: '2026-10-08' },
    { kind: 'tasks', id: 'task', updatedAt: '2026-10-07' }
  ];
  assert.deepEqual(groupRecentUpdates(records, Object.keys(kindNames)).map(group => [group.kind, group.records.map(record => record.id)]), [
    ['projects', ['project']], ['tasks', ['task']], ['orders', ['new', 'old']]
  ]);
  assert.deepEqual(records.map(record => record.id), ['new', 'project', 'old', 'task']);
});

test('对象选项与更新分组共用菜单顺序，子对象紧跟所属模块', () => {
  const expected = ['products', 'maintenance', 'requirements', 'projects', 'planStages', 'planItems', 'contracts', 'paymentStages', 'payments', 'tasks', 'bugs', 'orders'];
  assert.deepEqual(Object.keys(kindNames), expected);
  assert.deepEqual(groupRecentUpdates(expected.toReversed().map(kind => ({ kind })), Object.keys(kindNames)).map(group => group.kind), expected);
});

test('没有更新时不生成空分类', () => {
  assert.deepEqual(groupRecentUpdates([], Object.keys(kindNames)), []);
});
