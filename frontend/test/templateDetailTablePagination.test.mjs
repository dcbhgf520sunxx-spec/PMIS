import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/components/admin/TemplateDetailTableSection/index.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function renderSection(pagination) {
  const exports = {};
  let pager;
  const dependencies = {
    '../SearchTable': { SearchTable: ({ dataSource }) => React.createElement('ul', null, dataSource.map(row => React.createElement('li', { key: row.id }, row.name))) },
    '../TemplateDetailPage': { TemplateDetailSection: ({ children }) => React.createElement('section', null, children), templateDetailSectionMarker: Symbol('detail-section') },
    '../TablePagination': { TablePagination: props => { pager = props; return React.createElement('nav', { 'aria-label': '分页' }, `第 ${props.current} 页，共 ${props.total} 条`); } },
    './index.css': {}
  };
  runInNewContext(compiled, { exports, require: id => dependencies[id] ?? require(id) });
  const html = renderToStaticMarkup(React.createElement(exports.TemplateDetailTableSection, {
    title: '关联数据', pagination,
    table: { columns: [], dataSource: [{ id: '2', name: '当前页对象' }] }
  }));
  return { html, pager };
}

test('既有详情表格未传分页时保持纯展示，不增加页脚', () => {
  const { html, pager } = renderSection();
  assert.match(html, /当前页对象/);
  assert.equal(pager, undefined);
  assert.doesNotMatch(html, /aria-label="分页"/);
});

test('详情表格展示当前页数据，并将分页变化交给业务回调', () => {
  const changes = [];
  const { html, pager } = renderSection({ current: 2, pageSize: 6, total: 18, onChange: (page, size) => changes.push([page, size]) });
  assert.match(html, /当前页对象/);
  assert.match(html, /第 2 页，共 18 条/);
  pager.onChange(3, 12);
  assert.deepEqual(changes, [[3, 12]]);
});
