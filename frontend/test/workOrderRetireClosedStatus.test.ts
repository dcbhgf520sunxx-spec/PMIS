import assert from 'node:assert/strict';
import test from 'node:test';

async function loadRules() {
  try {
    return await import('../src/modules/work-order/workOrderStatusRules.ts');
  } catch {
    return undefined;
  }
}

test('运维工单现行状态取消已关闭', async () => {
  const rules = await loadRules();

  assert.deepEqual(rules?.activeWorkOrderStatuses, [0, 1, 2, 4, 5]);
});

test('待处理可以直接解决且所有现行流转都不包含已关闭', async () => {
  const rules = await loadRules();

  assert.deepEqual(rules?.statusTransitions, {
    0: [1, 2, 4],
    1: [2, 4],
    2: [4, 5],
    4: [0, 1, 2],
    5: [2]
  });
  assert.equal(
    Object.values(rules?.statusTransitions || {}).some((targets) => targets.includes(3)),
    false
  );
});

test('状态变更请求不再发送关闭时间', async () => {
  const rules = await loadRules();

  assert.equal(typeof rules?.buildStatusPayload, 'function');
  assert.deepEqual(rules!.buildStatusPayload(2, {
    actualFixedAt: { format: () => '2026-07-27' },
    result: '处理完成',
    closedAt: { format: () => '2026-07-28' }
  }), {
    status: 2,
    resolveDate: '2026-07-27',
    suspendDate: undefined,
    resultDesc: '处理完成',
    activationReason: undefined
  });
});
