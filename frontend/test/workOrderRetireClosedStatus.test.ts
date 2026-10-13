import assert from 'node:assert/strict';
import test from 'node:test';

async function loadRules() {
  try {
    return await import('../src/modules/work-order/workOrderStatusRules.ts');
  } catch {
    return undefined;
  }
}

test('运维工单现行状态包含已关闭', async () => {
  const rules = await loadRules();

  assert.deepEqual(rules?.activeWorkOrderStatuses, [0, 1, 2, 3, 4, 5]);
});

test('待处理可以直接解决且现行流转支持关闭及恢复', async () => {
  const rules = await loadRules();

  assert.deepEqual(rules?.statusTransitions, {
    0: [1, 2, 4, 3],
    1: [2, 4, 3],
    2: [4, 5, 3],
    3: [0, 1, 2, 4],
    4: [0, 1, 2, 3],
    5: [2]
  });
  assert.equal(
    Object.values(rules?.statusTransitions || {}).some((targets) => targets.includes(3)),
    true
  );
});

test('状态变更请求支持关闭时间及原因', async () => {
  const rules = await loadRules();

  assert.equal(typeof rules?.buildStatusPayload, 'function');
  assert.deepEqual(rules!.buildStatusPayload(2, {
    actualFixedAt: { format: () => '2026-07-27' },
    result: '处理完成',
    closedAt: { format: () => '2026-07-28' }
  }), {
    status: 2,
    closeDate: '2026-07-28',
    closeReason: undefined,
    resolveDate: '2026-07-27',
    suspendDate: undefined,
    suspendReason: undefined,
    resultDesc: '处理完成',
    activationReason: undefined
  });
});
