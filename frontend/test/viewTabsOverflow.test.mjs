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
