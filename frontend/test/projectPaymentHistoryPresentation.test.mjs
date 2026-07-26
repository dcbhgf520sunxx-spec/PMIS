import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');
const timeline = read('src/components/admin/HistoryTimeline/index.tsx');
const projectDetail = read('src/modules/project/pages/ProjectDetailPage.tsx');
const detailDemo = read('src/modules/design-system/pages/demos/DetailTemplateDemo.tsx');

test('HistoryTimeline 支持当前值模式且默认仍展示字段差异', () => {
  assert.match(timeline, /changeMode\?: 'diff' \| 'values'/);
  assert.match(timeline, /item\.changeMode === 'values'/);
  assert.match(timeline, /formatHistoryValue\(change\.field, change\.after\)/);
  assert.match(timeline, /admin-history-timeline__arrow/);
});

test('项目付款历史将阶段放入标题并从展开明细移除', () => {
  assert.match(projectDetail, /const isPaymentAction = item\.action === '登记付款' \|\| item\.action === '更正付款'/);
  assert.match(projectDetail, /paymentStageChange/);
  assert.match(projectDetail, /`\$\{item\.action\} · \$\{paymentStageChange\.new_value\}`/);
  assert.match(projectDetail, /!isPaymentAction \|\| change\.field_name !== '付款阶段'/);
  assert.match(projectDetail, /changeMode: item\.action === '登记付款' \? 'values' : 'diff'/);
});

test('组件工作台展示当前值模式示例', () => {
  assert.match(detailDemo, /action: '登记付款 · 阶段一'/);
  assert.match(detailDemo, /changeMode: 'values'/);
});
