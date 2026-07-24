import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(file, 'utf8');

test('工单前端声明被激活状态及流转矩阵', () => {
  const types = read('src/modules/work-order/types.ts');
  const helpers = read('src/modules/work-order/helpers.tsx');
  const rules = read('src/modules/work-order/pages/workOrderList.constants.ts');
  assert.match(types, /0 \| 1 \| 2 \| 3 \| 4 \| 5/);
  assert.match(helpers, /被激活/);
  assert.match(rules, /2:\s*\[3,\s*4,\s*5\]/);
  assert.match(rules, /3:\s*\[4,\s*5\]/);
  assert.match(rules, /5:\s*\[2\]/);
});

test('激活工单只填写激活原因，不显示新的预计完成时间', () => {
  const action = read('src/modules/work-order/components/WorkOrderStatusChangeAction/index.tsx');
  assert.match(action, /target === 5[\s\S]*name="activationReason"[\s\S]*激活原因/);
  assert.doesNotMatch(action, /newExpectedResolveDate|新的预计完成时间/);
});

test('工单激活字段接入接口、详情和历史展示', () => {
  const rules = read('src/modules/work-order/pages/workOrderList.constants.ts');
  const api = read('src/api/workOrderApi.ts');
  const detail = read('src/modules/work-order/pages/WorkOrderDetailPage.tsx');
  assert.match(rules, /activationReason:[\s\S]*values\.activationReason/);
  assert.doesNotMatch(rules, /newExpectedResolveDate/);
  assert.match(api, /activation_reason:\s*payload\.activationReason/);
  assert.doesNotMatch(api, /expected_resolve_date:\s*payload\.expectedResolveDate/);
  assert.match(detail, /label:\s*'激活原因'/);
});

test('批量状态变更不提供被激活', () => {
  const batch = read('src/modules/work-order/pages/useWorkOrderBatchActions.tsx');
  assert.match(batch, /item\.value !== 5/);
});
