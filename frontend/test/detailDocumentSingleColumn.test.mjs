import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('单据信息由底座强制单列，业务页无需手动标记 wide', () => {
  const source = fs.readFileSync(new URL('../src/components/admin/TemplateDetailPage/index.tsx',import.meta.url),'utf8');
  const section = source.slice(source.indexOf('function TemplateDetailSideSection('));
  assert.match(section, /columns=\{1\}/);
  assert.doesNotMatch(section, /columns=\{section\.columns/);
  const css = fs.readFileSync(new URL('../src/components/admin/DetailMetaList/index.css',import.meta.url),'utf8');
  assert.match(css,/\.admin-detail-meta-list\.is-columns-1\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});
