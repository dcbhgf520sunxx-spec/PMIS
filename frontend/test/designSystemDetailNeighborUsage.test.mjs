import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const detailDemoSource = readFileSync(new URL('../src/modules/design-system/pages/demos/DetailTemplateDemo.tsx', import.meta.url), 'utf8');
const displaySectionSource = readFileSync(new URL('../src/modules/design-system/pages/sections/DisplaySection.tsx', import.meta.url), 'utf8');
const baseSectionSource = readFileSync(new URL('../src/modules/design-system/pages/sections/BaseSection.tsx', import.meta.url), 'utf8');
const designSystemStyles = readFileSync(new URL('../src/modules/design-system/pages/DesignSystemShared.css', import.meta.url), 'utf8');

test('详情页模板示例展示中间位置的上一条下一条切换', () => {
  assert.ok(detailDemoSource.includes('DetailNeighborNav'), '详情页模板示例应展示 DetailNeighborNav');
  assert.ok(detailDemoSource.includes('titleCenter={'), '详情页模板示例应把切换条数放在标题栏中间');
  assert.ok(
    detailDemoSource.includes('TemplateDetailPage / DetailNeighborNav / TemplateDetailSection / DetailMetaList'),
    '模板组件入口应声明 DetailNeighborNav'
  );
});

test('组件工作台在基础组件的切换组件下展示详情条目切换', () => {
  const switchSectionIndex = baseSectionSource.indexOf('<h3>切换组件</h3>');
  const detailNeighborIndex = baseSectionSource.indexOf('<h4>详情条目切换</h4>');

  assert.ok(switchSectionIndex >= 0, '基础组件区应有切换组件');
  assert.ok(detailNeighborIndex > switchSectionIndex, '详情条目切换应放在基础组件的切换组件下');
  assert.ok(
    baseSectionSource.includes('ComponentEntry name="DetailNeighborNav / useDetailNeighbors"'),
    '组件入口应标明 DetailNeighborNav / useDetailNeighbors'
  );
  assert.equal(displaySectionSource.includes('<h3>详情条目切换</h3>'), false, '数据展示区不应重复展示详情条目切换');
});

test('详情条目切换说明复用紧凑的组件说明字号和间距', () => {
  assert.ok(baseSectionSource.includes('className="design-system-page__button-demo-description"'));
  assert.ok(designSystemStyles.includes('.design-system-page__button-demo-description'));
  assert.ok(designSystemStyles.includes('font-size: 12px'));
  assert.ok(designSystemStyles.includes('line-height: 18px'));
});

test('切换组件按紧凑高度配对且内容从顶部排列', () => {
  const listViewIndex = baseSectionSource.indexOf('<h4>列表数据视图切换</h4>');
  const localFilterIndex = baseSectionSource.indexOf('<h4>局部分类切换</h4>');
  const pageNavigationIndex = baseSectionSource.indexOf('<PageNavigationTabsDemo />');
  const detailNeighborIndex = baseSectionSource.indexOf('<h4>详情条目切换</h4>');

  assert.ok(listViewIndex < localFilterIndex, '列表视图和局部分类应放在第一行');
  assert.ok(localFilterIndex < pageNavigationIndex, '页面分类切换应放在第二行');
  assert.ok(pageNavigationIndex < detailNeighborIndex, '详情条目切换应与页面分类切换配对');
  assert.match(
    designSystemStyles,
    /\.design-system-page__switch-demo-grid\s*>\s*\.design-system-page__button-demo\s*\{[\s\S]*?align-content:\s*start;/
  );
});
