const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSummaryEvidence, createSummaryService, completeSummary } = require('../src/services/digitalTwinAiSummary');
const record = (id, date = '2026-10-12 09:00:00') => ({ kind: 'tasks', id, name: `任务${id}`, status: '处理中', updatedAt: date, needsAttention: false, dueDate: '', chain: [] });
const snapshot = () => ({ product: { id: '1', name: '产品' }, asOf: '2026-10-12 12:00:00', groups: [{ title: '任务执行', available: true, metrics: [], note: '主任务单独统计' }, { title: '机密模块', available: false }], records: Array.from({ length: 40 }, (_, i) => record(String(i))), attention: [record('0')] });

test('总结只使用列表展示的最新5条，不混入全量统计或全景存量', () => {
  const data = snapshot();
  data.records.push(record('old', '2026-10-05 11:59:59'), record('future', '2026-10-12 13:00:00'));
  data.records[0].chain = [{ kind: 'tasks', id: 'parent' }];
  data.records[0].parentName = '检索升级一期';
  const evidence = buildSummaryEvidence(data);
  assert.equal(evidence.recentUpdatedCount, 5);
  assert.equal(evidence.recentByKind[0].count, 5);
  assert.equal(evidence.recentByKind[0].subtasks, 1);
  assert.equal(evidence.recentExamples.length, 5);
  assert.equal(evidence.recentExamples[0].parentName, '检索升级一期');
  assert.equal(Object.hasOwn(evidence, 'currentGroups'), false);
  assert.equal(Object.hasOwn(evidence, 'currentAttention'), false);
  assert.deepEqual(evidence.recentExamples.map(r => r.name), ['任务0', '任务1', '任务2', '任务3', '任务4']);
});

test('同一用户相同数据复用并合并并发生成，数据变化或用户不同重新生成', async () => {
  const data = snapshot(); let calls = 0;
  const generate = createSummaryService({ readSnapshot: async () => data, complete: async () => { calls++; return { text: '真实模型总结', model: 'test-model' }; } });
  const [a, b] = await Promise.all([generate('u1', '1'), generate('u1', '1')]);
  assert.deepEqual(a, b); assert.equal(calls, 1);
  assert.equal(a.updatedCount, 5);
  assert.deepEqual(JSON.parse(a.sourceRevision).map(r => r[1]), ['0', '1', '2', '3', '4']);
  data.asOf = '2026-10-12 12:01:00';
  await generate('u1', '1'); assert.equal(calls, 1);
  data.records[0].status = '已完成';
  await generate('u1', '1'); assert.equal(calls, 2);
  await generate('u2', '1'); assert.equal(calls, 3);
});
test('ISO时间与上海本地时间使用同一7天边界，空列表不混入存量', () => {
  const data = snapshot();
  data.records = [record('outside', '2026-10-05T03:59:59Z'), record('edge', '2026-10-05T04:00:00Z')];
  assert.deepEqual(buildSummaryEvidence(data).recentExamples.map(r => r.name), ['任务edge']);
  data.records = [];
  assert.equal(buildSummaryEvidence(data).recentUpdatedCount, 0);
  assert.deepEqual(buildSummaryEvidence(data).recentExamples, []);
});
test('手动重新生成跳过缓存，并发点击合并，自动读取复用新结果', async () => {
  let calls = 0; let release;
  const generate = createSummaryService({ readSnapshot: async () => snapshot(), complete: async () => {
    const count = ++calls;
    if (count === 2) await new Promise(resolve => { release = resolve; });
    return { text: `总结${count}`, model: 'test' };
  } });
  assert.equal((await generate('u', '1')).text, '总结1');
  assert.equal((await generate('u', '1')).text, '总结1');
  const forced = generate('u', '1', { force: true });
  await new Promise(resolve => setImmediate(resolve));
  const duplicate = generate('u', '1', { force: true });
  const automatic = generate('u', '1');
  release();
  const results = await Promise.all([forced, duplicate, automatic]);
  assert.ok(results.every(result => result.text === '总结2'));
  assert.equal(calls, 2);
  assert.equal((await generate('u', '1')).text, '总结2');
});
test('默认模型版本变化立即使总结缓存失效，停用默认模型拒绝旧结果', async () => {
  let connection = {revision:'one',model:'m1',provider:'自定义模型'}; let calls = 0;
  const generate = createSummaryService({readSnapshot:async () => snapshot(),readConnection:async () => {
    if (!connection) throw Object.assign(new Error('没有默认模型'),{status:503});
    return connection;
  },complete:async (_evidence,config) => {calls++; return {text:config.model,model:config.model};}});
  assert.equal((await generate('u','1')).text,'m1'); await generate('u','1'); assert.equal(calls,1);
  connection = {...connection,revision:'two',model:'m2'};
  assert.equal((await generate('u','1')).text,'m2'); assert.equal(calls,2);
  connection = null; await assert.rejects(generate('u','1'),{status:503}); assert.equal(calls,2);
});
test('数据库的短时区偏移和微秒时间不会漏掉最近7天记录', () => {
  const data = snapshot();
  data.records = [record('outside', '2026-10-05 11:59:59+08'), record('edge', '2026-10-05 12:00:00+08'), record('latest', '2026-10-12 12:00:00.123456+08')];
  const evidence = buildSummaryEvidence(data);
  assert.equal(evidence.recentUpdatedCount, 2);
  assert.deepEqual(evidence.recentExamples.map(r => r.name), ['任务latest', '任务edge']);
});

test('权限拒绝不调用模型，模型失败不会缓存且可重试', async () => {
  let calls = 0;
  const denied = createSummaryService({ readSnapshot: async () => { throw Object.assign(new Error('无权限'), { status: 403 }); }, complete: async () => { calls++; } });
  await assert.rejects(denied('u', '1'), { status: 403 }); assert.equal(calls, 0);
  await assert.rejects(denied('u', '1', { force: true }), { status: 403 }); assert.equal(calls, 0);
  const retry = createSummaryService({ readSnapshot: async () => snapshot(), complete: async () => { if (++calls === 1) throw new Error('失败'); return { text: '恢复', model: 'test' }; } });
  await assert.rejects(retry('u', '1'));
  assert.equal((await retry('u', '1')).text, '恢复');
});

test('接口拒绝非布尔重新生成参数', async () => {
  const { aiSummary } = require('../src/controllers/digitalTwinController');
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await aiSummary({ params: { id: '78' }, body: { force: 'true' }, user: { id: 'u' } }, res, error => { throw error; });
  assert.equal(res.code, 400);
  assert.equal(res.body.message, '重新生成参数不正确');
});

test('DeepSeek调用使用服务端凭据，未配置和上游错误不会泄露响应或密钥', async () => {
  await assert.rejects(completeSummary({}, { apiKey: '' }), { status: 503 });
  let request;
  const result = await completeSummary({ product: '测试产品' }, { apiKey: 'test-secret', fetchImpl: async (url, init) => { request = { url, init }; return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: '总结\n内容' } }] }) }; } });
  assert.equal(request.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(JSON.parse(request.init.body).thinking.type, 'disabled');
  assert.equal(result.text, '总结 内容');
  await assert.rejects(completeSummary({}, { apiKey: 'test-secret', fetchImpl: async () => ({ ok: false, status: 401 }) }), error => error.status === 502 && !error.message.includes('test-secret'));
  await assert.rejects(completeSummary({}, { apiKey: 'test-secret', fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '截断' } }] }) }) }), { status: 502 });
});

test('真实产品证据的时间说明不进入个人周期简报流程', async () => {
  const evidence = buildSummaryEvidence(snapshot());
  let calls = 0;
  const result = await completeSummary(evidence, { apiKey: 'test-secret', fetchImpl: async (_url, init) => {
    calls++;
    const body = JSON.parse(init.body);
    assert.ok(body.messages[0].content.includes('recentExamples'));
    assert.equal(body.max_tokens, 500);
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: '推进产品检索联调。下一步验证异常分支。' } }] }) };
  } });
  assert.equal(calls, 1);
  assert.equal(result.text, '推进产品检索联调。下一步验证异常分支。');
  assert.equal(result.sections, undefined);
});
