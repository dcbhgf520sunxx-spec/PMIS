import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const readIfPresent = (path) => {
  const url = new URL(`../${path}`, import.meta.url);
  return existsSync(url) ? readFileSync(url, 'utf8') : '';
};

const component = readIfPresent('src/components/admin/TemplateDetailTableSection/index.tsx');
const componentStyles = readIfPresent('src/components/admin/TemplateDetailTableSection/index.css');
const detailTemplate = readIfPresent('src/components/admin/TemplateDetailPage/index.tsx');
const componentExports = readIfPresent('src/components/admin/index.ts');
const workbenchDemo = readIfPresent('src/modules/design-system/pages/demos/DetailTemplateDemo.tsx');
const developmentRules = readIfPresent('../docs/ai-development-rules.md');
const searchTable = readIfPresent('src/components/admin/SearchTable/index.tsx');
const sectionTitle = readIfPresent('src/components/admin/SectionTitle/index.tsx');
const sectionTitleStyles = readIfPresent('src/components/admin/SectionTitle/index.css');

test('详情表格分组复用详情分组和 SearchTable，并固定关闭完整列表外壳', () => {
  assert.match(component, /export const TemplateDetailTableSection/);
  assert.match(component, /<TemplateDetailSection/);
  assert.match(component, /<SearchTable<T, P>/);
  assert.match(component, /cardProps=\{false\}/);
  assert.match(component, /search=\{false\}/);
  assert.match(component, /options=\{false\}/);
  assert.match(component, /toolBarRender=\{false\}/);
  assert.match(component, /pagination=\{false\}/);
  assert.match(component, /customizable=\{false\}/);
});

test('详情分组开放右侧 extra，详情表格摘要与右侧动作由分组标题承接', () => {
  assert.match(detailTemplate, /extra\?: ReactNode/);
  assert.match(detailTemplate, /<SectionTitle[\s\S]*extra=\{extra\}/);
  assert.match(component, /inlineExtra=\{summary/);
  assert.match(component, /extra=\{extra\}/);
  assert.match(componentStyles, /admin-template-detail-table-section__summary/);
  assert.match(component, /templateDetailSectionMarker/);
  assert.match(detailTemplate, /componentType\[templateDetailSectionMarker\]/);
});

test('标题后摘要与右侧 extra 同时存在时保持左右分布', () => {
  assert.match(sectionTitle, /extra \? 'has-extra'/);
  assert.match(sectionTitleStyles, /is-inline-extra-after-title\.has-extra[\s\S]*justify-content:\s*space-between/);
});

test('详情表格关闭列个性化时不启用偏好状态和列宽拖拽', () => {
  assert.match(searchTable, /customizable\?: boolean/);
  assert.match(searchTable, /customizable = true/);
  assert.match(searchTable, /customizable \? [\s\S]*columnsState/);
  assert.match(searchTable, /if \(!customizable\)/);
  assert.match(searchTable, /size=\{customizable \? tableSize : 'small'\}/);
  assert.doesNotMatch(searchTable, /defaultSize=\{customizable \? tableSize : 'small'\}/);
});

test('详情表格横向滚动时固定首个业务列并为滚动条预留空间', () => {
  assert.match(component, /firstBusinessColumnIndex/);
  assert.match(component, /fixed:\s*'left'/);
  assert.match(component, /has-horizontal-scroll/);
  assert.match(
    componentStyles,
    /has-horizontal-scroll \.ant-table-content[\s\S]*has-horizontal-scroll \.ant-table-body[\s\S]*padding-bottom:\s*16px/
  );
  assert.match(workbenchDemo, /scroll:\s*\{ x:\s*1100 \}/);
  assert.match(developmentRules, /横向滚动时自动固定首个业务列/);
  assert.match(developmentRules, /滚动条预留底部空间/);
});

test('组件工作台可管理详情表格将操作列固定在右侧', () => {
  assert.match(
    workbenchDemo,
    /title:\s*'操作',[\s\S]*?valueType:\s*'option' as const,[\s\S]*?width:\s*110,[\s\S]*?fixed:\s*'right'/
  );
});

test('组件工作台页面模式详情页展示纯展示、可查看、可管理和空数据状态', () => {
  assert.match(componentExports, /export \* from '\.\/TemplateDetailTableSection'/);
  assert.match(workbenchDemo, /TemplateDetailTableSection/);
  assert.match(workbenchDemo, /纯展示/);
  assert.match(workbenchDemo, /可查看/);
  assert.match(workbenchDemo, /可管理/);
  assert.match(workbenchDemo, /空数据/);
  assert.match(developmentRules, /TemplateDetailTableSection/);
});
