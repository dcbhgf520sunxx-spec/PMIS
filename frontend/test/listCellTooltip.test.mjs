import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { cloneElement, createElement, isValidElement } from 'react';

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

test('原生省略保留格式化节点和单元格提示，不受内层空title屏蔽', () => {
  const source = readFileSync(new URL('../src/components/admin/SearchTable/index.tsx', import.meta.url), 'utf8');
  const file = ts.createSourceFile('SearchTable.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'withListCellTitle');
  const code = ts.transpileModule(declaration.getText(file), { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
  const adapt = vm.runInNewContext(`${code};withListCellTitle`, { cloneElement, isValidElement, getListCellTitle, readListCellValue });
  const column = adapt({ dataIndex: 'amount', valueType: 'money', onCell: () => ({ title: '自定义完整提示', className: 'business-cell' }) });
  const formatted = createElement('span', { title: '', className: 'ant-typography' }, '￥1,234.50');
  const rendered = column.render(formatted);
  assert.equal(column.ellipsis.showTitle, false);
  assert.equal(rendered.props.children, '￥1,234.50');
  assert.equal(rendered.props.className, 'ant-typography');
  assert.equal(rendered.props.title, undefined);
  assert.equal(column.onCell({ amount: 1234.5 }).title, '自定义完整提示');
  assert.equal(column.onCell({ amount: 1234.5 }).className, 'business-cell');
  assert.equal(adapt({ dataIndex: 'amount' }).onCell({ amount: 0 }).title, '0');
  assert.equal(column.render(createElement('span', { title: '原有提示' })).props.title, '原有提示');
  for (const ellipsis of [true, false, { showTitle: true }]) {
    const explicit = adapt({ dataIndex: 'amount', ellipsis });
    assert.equal(explicit.ellipsis, ellipsis);
    assert.equal(explicit.render, undefined);
  }
  const custom = { dataIndex: 'amount', render: () => '业务内容' };
  assert.equal(adapt(custom), custom);
});

test('DetailLinkCell 未显式传入提示时自动使用文字内容', () => {
  const source = readFileSync(
    new URL('../src/components/admin/DetailLinkCell/index.tsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /const resolvedTitle = title \?\? getListCellTitle\(children\)/);
  assert.match(source, /title=\{resolvedTitle\}/);
});
