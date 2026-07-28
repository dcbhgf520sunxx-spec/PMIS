import assert from 'node:assert/strict';
import test from 'node:test';
import * as listHelpers from '../src/components/admin/listHelpers.ts';

const {
  createListFilterItems,
  createListSorters,
  listSorters,
  visibleListFilterItems
} = listHelpers;

type Row = {
  name?: string;
  score?: number;
  createdAt?: string;
  status: number;
};

test('visibleListFilterItems removes hidden filters and keeps item order', () => {
  const items = visibleListFilterItems([
    { key: 'name', label: '名称' },
    { key: 'owner', label: '负责人', hidden: true },
    { key: 'status', label: '状态', hidden: false }
  ]);

  assert.deepEqual(items.map((item) => item.key), ['name', 'status']);
});

test('createListFilterItems applies hidden filtering for filter declarations', () => {
  const items = createListFilterItems([
    { key: 'keyword', label: '关键字' },
    { key: 'advanced', label: '高级项', hidden: true }
  ]);

  assert.deepEqual(items.map((item) => item.key), ['keyword']);
});

test('resolveListViewFilter keeps the submitted filter while mine view removes only the current-list scope', () => {
  const resolveListViewFilter = (
    listHelpers as typeof listHelpers & {
      resolveListViewFilter?: <T>(view: string, value: T) => {
        filterValue: T;
        scopeValue: T | undefined;
      };
    }
  ).resolveListViewFilter;

  assert.deepEqual(resolveListViewFilter?.('all', '002059'), {
    filterValue: '002059',
    scopeValue: '002059'
  });
  assert.deepEqual(resolveListViewFilter?.('mine', '002059'), {
    filterValue: '002059',
    scopeValue: undefined
  });
});

test('createListSorters builds text, number, date and custom sorters', () => {
  const sorters = createListSorters<Row>({
    name: listSorters.text((row) => row.name),
    score: listSorters.number((row) => row.score),
    createdAt: listSorters.date((row) => row.createdAt),
    status: listSorters.custom((a, b) => b.status - a.status)
  });

  const left = { name: 'A', score: 2, createdAt: '2026-07-09', status: 1 };
  const right = { name: 'B', score: 10, createdAt: '2026-07-10', status: 3 };

  assert.ok(sorters.name(left, right) < 0);
  assert.ok(sorters.score(left, right) < 0);
  assert.ok(sorters.createdAt(left, right) < 0);
  assert.ok(sorters.status(left, right) > 0);
});
