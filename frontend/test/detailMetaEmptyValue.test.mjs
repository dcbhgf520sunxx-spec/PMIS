import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { normalizeDetailMetaValue } from '../src/components/admin/DetailMetaList/normalizeValue.ts';

test('详情字段的空值统一显示短横线', () => {
  assert.equal(normalizeDetailMetaValue(undefined), '-');
  assert.equal(normalizeDetailMetaValue(null), '-');
  assert.equal(normalizeDetailMetaValue(''), '-');
  assert.equal(normalizeDetailMetaValue('   '), '-');
});

test('详情字段保留数字零和已有内容', () => {
  assert.equal(normalizeDetailMetaValue(0), 0);
  assert.equal(normalizeDetailMetaValue('正常内容'), '正常内容');
});

test('DetailMetaList 在截断和提示前统一处理空值', () => {
  const source = readFileSync(
    new URL('../src/components/admin/DetailMetaList/index.tsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /const value = normalizeDetailMetaValue\(item\.value\)/);
  assert.match(source, /<dd[^>]*>\{value\}<\/dd>/);
  assert.match(source, /<Tooltip title=\{value\}>/);
});

test('富文本没有内容时默认显示短横线', () => {
  const source = readFileSync(
    new URL('../src/components/admin/RichTextViewer/index.tsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /emptyText = '-'/);
});
