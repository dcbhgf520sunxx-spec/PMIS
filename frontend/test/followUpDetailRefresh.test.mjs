import assert from 'node:assert/strict';
import test from 'node:test';

let refreshFollowUpDetail;
try {
  ({ refreshFollowUpDetail } = await import('../src/modules/follow-up/refreshFollowUpDetail.ts'));
} catch (error) {
  if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

test('跟进操作完成后同时更新跟进记录和变更历史', async () => {
  assert.equal(typeof refreshFollowUpDetail, 'function');
  const applied = [];

  await refreshFollowUpDetail({
    loadFollowUps: async () => [{ id: 'follow-up-1', content: '本周完成联调' }],
    loadHistory: async () => [{ id: 'history-1', action: '新增跟进' }],
    apply: (followUps, history) => applied.push({ followUps, history }),
  });

  assert.deepEqual(applied, [{
    followUps: [{ id: 'follow-up-1', content: '本周完成联调' }],
    history: [{ id: 'history-1', action: '新增跟进' }],
  }]);
});
