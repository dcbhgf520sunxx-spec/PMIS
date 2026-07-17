import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getListCellTitle, readListCellValue } from '../src/components/admin/SearchTable/listCellTitle.ts';

test('普通列表字段能从直接字段和嵌套字段取得完整内容', () => {
  const record = {
    name: '一个很长的产品名称',
    owner: { displayName: '孙鑫鑫' }
  };

  assert.equal(readListCellValue(record, 'name'), '一个很长的产品名称');
  assert.equal(readListCellValue(record, ['owner', 'displayName']), '孙鑫鑫');
});

test('只有适合直接展示的基础值才生成悬停完整内容', () => {
  assert.equal(getListCellTitle('完整内容'), '完整内容');
  assert.equal(getListCellTitle(2026), '2026');
  assert.equal(getListCellTitle(''), undefined);
  assert.equal(getListCellTitle(null), undefined);
  assert.equal(getListCellTitle({ label: '启用' }), undefined);
});

test('SearchTable 自动为普通字段补全提示并保留页面自定义单元格属性', () => {
  const source = readFileSync(
    new URL('../src/components/admin/SearchTable/index.tsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /withListCellTitle/);
  assert.match(source, /title:\s*getListCellTitle/);
  assert.match(source, /\.\.\.originalCellProps/);
});

test('DetailLinkCell 未显式传入提示时自动使用文字内容', () => {
  const source = readFileSync(
    new URL('../src/components/admin/DetailLinkCell/index.tsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /const resolvedTitle = title \?\? getListCellTitle\(children\)/);
  assert.match(source, /title=\{resolvedTitle\}/);
});
