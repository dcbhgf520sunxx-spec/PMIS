import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');
const component = read('src/components/admin/HistoryTimeline/index.tsx');
const section = read('src/components/admin/TemplateDetailPage/index.tsx');
const sectionTitle = read('src/components/admin/SectionTitle/index.tsx');
const sectionTitleCss = read('src/components/admin/SectionTitle/index.css');
const workOrder = read('src/modules/work-order/pages/WorkOrderDetailPage.tsx');
const template = read('src/modules/work-order-template/pages/WorkOrderTemplateDetailPage.tsx');

test('HistoryTimeline 内置全部展开和全部收起', () => {
  assert.match(component, /expandableKeys/);
  assert.match(component, /isAllExpanded/);
  assert.match(component, /全部收起/);
  assert.match(component, /全部展开/);
  assert.match(component, /AdminTextAction/);
});

test('HistoryTimelineSection 把批量按钮放在变更历史标题后', () => {
  assert.match(section, /<TemplateDetailSection/);
  assert.match(section, /title="变更历史"/);
  assert.match(section, /inlineExtra=/);
  assert.match(section, /全部收起/);
  assert.match(section, /全部展开/);
  assert.match(section, /inlineExtraPlacement="after-title"/);
  assert.match(sectionTitle, /is-inline-extra-after-title/);
  assert.match(sectionTitleCss, /\.admin-section-title\.is-inline-extra-after-title\s*>\s*\.admin-section-title__content/);
  assert.match(sectionTitleCss, /flex:\s*0 0 auto/);
});

test('HistoryTimelineSection 没有可展开明细时仍展示禁用的全部展开按钮', () => {
  assert.doesNotMatch(section, /inlineExtra=\{expandableKeys\.length\s*\?/);
  assert.match(section, /disabled=\{expandableKeys\.length === 0\}/);
});

test('业务详情和页面样板不再手工维护历史批量展开', () => {
  for (const source of [workOrder, template]) {
    assert.doesNotMatch(source, /historyExpandedKeys/);
    assert.doesNotMatch(source, /inlineExtra=.*全部/);
    assert.doesNotMatch(source, /onExpandedKeysChange/);
    assert.match(source, /<HistoryTimelineSection/);
  }
});
