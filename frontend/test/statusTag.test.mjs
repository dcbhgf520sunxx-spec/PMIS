import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const statusTagStyles = await readFile(
  new URL('../src/components/admin/StatusTag/index.css', import.meta.url),
  'utf8'
);

test('状态标签图标与文字保持紧凑间距', () => {
  assert.match(
    statusTagStyles,
    /\.admin-status-tag \.anticon\s*\{[^}]*margin-inline-end:\s*4px;/s
  );
  assert.match(
    statusTagStyles,
    /\.admin-status-tag\.ant-tag \.anticon \+ span\s*\{[^}]*margin-inline-start:\s*0;/s
  );
});
