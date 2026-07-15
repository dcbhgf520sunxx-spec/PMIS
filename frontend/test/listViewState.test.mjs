import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const hookPath = new URL('../src/components/admin/TemplateListPage/useListViewState.ts', import.meta.url);

test('地址同步模式只从路由派生视图，避免内部状态与旧地址互相覆盖', () => {
  const source = readFileSync(hookPath, 'utf8');

  assert.match(source, /const view = urlSync \? readView\(\) : localView/);
  assert.doesNotMatch(source, /useEffect/);
  assert.doesNotMatch(source, /setViewState\(next\)/);
});
