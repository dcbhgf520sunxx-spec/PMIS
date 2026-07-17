import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../src/components/admin/DataListPage/useListPageData.ts', import.meta.url),
  'utf8'
);

test('只切换页码时不触发筛选条件重置第一页', () => {
  assert.match(source, /const setCurrentPageRef = useRef\(setCurrentPage\)/);
  assert.match(source, /setCurrentPageRef\.current = setCurrentPage/);
  assert.match(source, /setCurrentPageRef\.current\(1\)/);
  assert.match(source, /\}, \[resetKey\]\);/);
  assert.doesNotMatch(source, /\}, \[resetKey, setCurrentPage\]\);/);
});
