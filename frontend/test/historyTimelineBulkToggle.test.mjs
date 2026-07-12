import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');
const component = read('src/components/admin/HistoryTimeline/index.tsx');
const workOrder = read('src/modules/work-order/pages/WorkOrderDetailPage.tsx');
const template = read('src/modules/work-order-template/pages/WorkOrderTemplateDetailPage.tsx');

test('HistoryTimeline 内置全部展开和全部收起', () => {
  assert.match(component, /expandableKeys/);
  assert.match(component, /isAllExpanded/);
  assert.match(component, /全部收起/);
  assert.match(component, /全部展开/);
  assert.match(component, /AdminTextAction/);
});

test('业务详情和页面样板不再手工维护历史批量展开', () => {
  for (const source of [workOrder, template]) {
    assert.doesNotMatch(source, /historyExpandedKeys/);
    assert.doesNotMatch(source, /inlineExtra=.*全部/);
    assert.doesNotMatch(source, /onExpandedKeysChange/);
  }
});
