import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const template = readFileSync(new URL('../src/components/admin/TemplateListPage/index.tsx', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../src/components/admin/TemplateListPage/useListScrollRestoration.ts', import.meta.url), 'utf8');

test('标准列表按完整地址恢复纵向和表格横向位置', () => {
  assert.match(template, /useListScrollRestoration/);
  assert.match(hook, /sessionStorage/);
  assert.match(hook, /window\.scrollTo/);
  assert.match(hook, /\.ant-table-body/);
});

test('滚动恢复不得在页面壳与列表主体之间增加布局容器', () => {
  assert.doesNotMatch(template, /<div ref=\{scrollRootRef\}>\{content\}<\/div>/);
});
