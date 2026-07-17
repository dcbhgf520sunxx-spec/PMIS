import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const readIfPresent = (path) => {
  const url = new URL(`../${path}`, import.meta.url);
  return existsSync(url) ? readFileSync(url, 'utf8') : '';
};

const hierarchyCell = readIfPresent('src/components/admin/HierarchyListCell/index.tsx');
const hierarchyCellStyles = readIfPresent('src/components/admin/HierarchyListCell/index.css');
const componentExports = readIfPresent('src/components/admin/index.ts');
const templateListSource = readIfPresent('src/components/admin/TemplateListPage/index.tsx');
const layoutSectionSource = readIfPresent('src/modules/design-system/pages/sections/layout/ListTemplateDemo.tsx');
const developmentRules = readIfPresent('../docs/ai-development-rules.md');

test('层级列表把方框开关和主子标识固定在名称单元格内', () => {
  assert.match(hierarchyCell, /export function HierarchyListCell/);
  assert.match(hierarchyCell, /<ExpandToggleButton/);
  assert.match(hierarchyCell, /variant="square"/);
  assert.match(hierarchyCell, /level === 'parent'[\s\S]*<CategoryTag/);
  assert.match(hierarchyCell, /level === 'child'[\s\S]*<AdminTag>子<\/AdminTag>/);
  assert.ok(hierarchyCell.indexOf('<ExpandToggleButton') < hierarchyCell.indexOf("level === 'parent'"));
  assert.ok(hierarchyCell.indexOf("level === 'parent'") < hierarchyCell.indexOf('admin-hierarchy-list-cell__content'));
});

test('层级名称单元格沿用 PMIS 的紧凑尺寸和子任务缩进', () => {
  assert.match(hierarchyCellStyles, /\.admin-hierarchy-list-cell\s*\{[^}]*gap:\s*2px/s);
  assert.match(hierarchyCellStyles, /\.admin-hierarchy-list-cell\.is-child\s*\{[^}]*padding-left:\s*20px/s);
  assert.match(hierarchyCellStyles, /\.admin-hierarchy-list-cell__toggle\.admin-expand-toggle-button\.ant-btn-sm\s*\{[^}]*width:\s*18px[^}]*height:\s*18px[^}]*min-width:\s*18px/s);
  assert.match(hierarchyCellStyles, /\.admin-hierarchy-list-cell\s*>\s*\.ant-tag\s*\{[^}]*width:\s*18px[^}]*height:\s*18px[^}]*min-width:\s*18px/s);
});

test('层级列表作为公共单元格导出，不再使用表格原生展开列', () => {
  assert.match(componentExports, /export \* from '\.\/HierarchyListCell'/);
  assert.equal(templateListSource.includes('TemplateListHierarchy'), false);
  assert.equal(templateListSource.includes('childrenColumnName'), false);
  assert.equal(templateListSource.includes('defaultExpandAllRows'), false);
});

test('组件工作台按 PMIS 的平铺分组方式展示并默认收起子项', () => {
  assert.match(layoutSectionSource, /HierarchyListCell/);
  assert.match(layoutSectionSource, /expandedHierarchyParentIds/);
  assert.match(layoutSectionSource, /visibleHierarchyTemplateRows/);
  assert.match(layoutSectionSource, /level=\{row\.hierarchyParentId \? 'child' : row\.hierarchyChildCount > 0 \? 'parent' : undefined\}/);
  assert.match(layoutSectionSource, /hasChildren=\{row\.hierarchyChildCount > 0\}/);
  assert.match(developmentRules, /HierarchyListCell/);
  assert.match(developmentRules, /方框开关、主子标识和子级缩进/);
});
