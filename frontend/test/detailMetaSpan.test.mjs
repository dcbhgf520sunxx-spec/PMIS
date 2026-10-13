import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/components/admin/DetailMetaList/index.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)((id) => {
  if (id.endsWith('.css')) return {};
  if (id === './normalizeValue') return require('../src/components/admin/DetailMetaList/normalizeValue.ts');
  return require(id);
}, module, module.exports);
const { DetailMetaList } = module.exports;

test('详情时间另起一行，三格原因保留原始换行和空值规则', () => {
  const html = renderToStaticMarkup(React.createElement(DetailMetaList, { items: [
    { label: '暂停时间', value: '2026-10-13', startRow: true },
    { label: '暂停原因', value: '第一行\n第二行', span: 3, longText: true },
    { label: '关闭时间', value: null, startRow: true },
    { label: '关闭原因', value: ' ', span: 3, longText: true },
  ] }));
  assert.match(html, /class="admin-detail-meta-list__item is-row-start"><dt>暂停时间/);
  assert.match(html, /class="admin-detail-meta-list__item is-span-3"><dt>暂停原因/);
  assert.match(html, /第一行\n第二行/);
  assert.match(html, /<dt>关闭原因<\/dt><dd class="is-long-text">-<\/dd>/);
});

test('整行配置继续兼容，跨列数不能超过显式列数', () => {
  const html = renderToStaticMarkup(React.createElement(DetailMetaList, { columns: 1, items: [
    { label: '原因', value: '原因', span: 3, longText: true },
    { label: '说明', value: '说明', wide: true, span: 3, longText: true },
  ] }));
  assert.match(html, /class="admin-detail-meta-list__item is-span-1"><dt>原因/);
  assert.match(html, /class="admin-detail-meta-list__item is-wide"><dt>说明/);
  assert.doesNotMatch(html, /is-span-3/);
});
