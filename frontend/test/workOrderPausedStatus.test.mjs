import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(file, 'utf8');

test('工单前端声明已暂停状态及完整流转矩阵', () => {
  const types = read('src/modules/work-order/types.ts');
  const helpers = read('src/modules/work-order/helpers.tsx');
  const rules = read('src/modules/work-order/pages/workOrderList.constants.ts');
  assert.match(types, /0 \| 1 \| 2 \| 3 \| 4/);
  assert.match(helpers, /已暂停/);
  assert.match(rules, /0:\s*\[1,\s*4\]/);
  assert.match(rules, /1:\s*\[2,\s*4\]/);
  assert.match(rules, /2:\s*\[3,\s*4\]/);
  assert.match(rules, /3:\s*\[4\]/);
  assert.match(rules, /4:\s*\[0,\s*1,\s*2,\s*3\]/);
});

test('暂停工单直接关闭时要求重新填写三项结果字段', () => {
  const action = read('src/modules/work-order/components/WorkOrderStatusChangeAction/index.tsx');
  assert.match(action, /workOrder\.status === 4 && target === 3/);
  assert.match(action, /实际修复时间/);
  assert.match(action, /关闭时间/);
  assert.match(action, /处置结果/);
});

test('工单进入暂停时必填暂停时间并提交到接口', () => {
  const action = read('src/modules/work-order/components/WorkOrderStatusChangeAction/index.tsx');
  const rules = read('src/modules/work-order/pages/workOrderList.constants.ts');
  const api = read('src/api/workOrderApi.ts');
  const detail = read('src/modules/work-order/pages/WorkOrderDetailPage.tsx');
  assert.match(action, /target === 4[\s\S]*name="suspendedAt"[\s\S]*暂停时间/);
  assert.match(rules, /suspendDate:[\s\S]*values\.suspendedAt/);
  assert.match(api, /suspend_date:\s*payload\.suspendDate/);
  assert.match(detail, /label:\s*'暂停时间'/);
});
