import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const viewTabsStyles = readFileSync(
  new URL('../src/components/admin/ViewTabs/index.css', import.meta.url),
  'utf8'
);

test('ViewTabs 只允许横向滚动，不出现纵向滚动条', () => {
  assert.match(
    viewTabsStyles,
    /\.admin-view-tabs\s*\{[\s\S]*?overflow-x:\s*auto;[\s\S]*?overflow-y:\s*hidden;/
  );
});

test('ViewTabs 不展示横跨容器的底部分隔线', () => {
  const rootRule = viewTabsStyles.match(/\.admin-view-tabs\s*\{([\s\S]*?)\}/)?.[1] || '';
  assert.doesNotMatch(rootRule, /border-bottom\s*:/);
  assert.match(viewTabsStyles, /\.admin-view-tabs__item\.is-active::after\s*\{[\s\S]*?background:\s*var\(--app-primary\);/);
});
