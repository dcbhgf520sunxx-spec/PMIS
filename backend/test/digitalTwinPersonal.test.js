const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPersonalSnapshot, personalSourceQueries, personalSnapshot } = require('../src/services/digitalTwinPersonalService');
const permissions = new Set(['/products', '/requirements', '/projects', '/tasks', '/bugs', '/work-orders']);
const row = (id, extra = {}) => ({ id: String(id), name: `工作${id}`, status: 1, relationship: 'responsible', priority: 2, product_id: '1', product_name: '产品甲', owner_name: '本人', created_at: '2026-10-10 09:00:00', updated_at: '2026-10-14 08:00:00', expected_end_date: '2026-10-15', ...extra });
const person = { id: '7', real_name: '本人' };

test('个人汇总按责任角色去重，参与项目不扩展为项目下他人的任务', () => {
  const result = buildPersonalSnapshot(person, { projects: [row(1), row(2, { relationship: 'participant' })], tasks: [row(3), row(3), row(4, { parent_task_id: '3', product_id: '2', product_name: '产品乙' })] }, permissions, '2026-10-14 09:00:00');
  assert.equal(result.records.length, 4);
  assert.equal(result.overview.responsible, 3);
  assert.equal(result.overview.participating, 1);
  assert.equal(result.overview.products, 2);
  assert.equal(result.records.find(r => r.id === '4').isSubtask, true);
  assert.ok(!result.priorities.some(r => r.id === '2'));
  assert.equal(result.groups.find(g => g.kind === 'tasks').metrics[0].value, '2');
});

test('结束和上级关闭不进入优先处理；暂停不算逾期，到期按上海日历日', () => {
  const result = buildPersonalSnapshot(person, { tasks: [row(1, { status: 4 }), row(2, { status: 2 }), row(3, { parent_closed: true }), row(4, { status: 3, expected_end_date: '2026-10-01' }), row(5, { priority: 0, expected_end_date: '2026-10-13' }), row(6, { priority: 0, expected_end_date: '2026-10-21' }), row(7, { priority: 0, expected_end_date: '2026-10-22' })] }, permissions, '2026-10-14 09:00:00');
  assert.ok(!result.priorities.some(r => ['1', '2', '3'].includes(r.id)));
  assert.equal(result.records.find(r => r.id === '4').isOverdue, false);
  assert.equal(result.records.find(r => r.id === '5').isOverdue, true);
  assert.equal(result.records.find(r => r.id === '6').dueSoon, true);
  assert.equal(result.records.find(r => r.id === '7').dueSoon, false);
  assert.equal(result.priorities[0].id, '5');
});

test('未授权模块与来源不泄漏，空数据正常返回，BUG关闭与取消关闭分开', () => {
  const result = buildPersonalSnapshot(person, { projects: [row(1)], tasks: [row(2, { project_id: 'secret', project_name: '未授权项目', product_name: '未授权产品' })] }, new Set(['/tasks']), '2026-10-14 09:00:00');
  assert.equal(result.records.length, 1);
  assert.ok(!JSON.stringify(result).includes('secret'));
  assert.ok(!JSON.stringify(result).includes('未授权项目'));
  assert.equal(result.records[0].productName, '—');
  const empty = buildPersonalSnapshot(person, {}, permissions, '2026-10-14 09:00:00');
  assert.equal(empty.overview.responsible, 0);
  const bugs = buildPersonalSnapshot(person, { bugs: [row(1, { severity: 4, status: 2 }), row(2, { severity: 3, status: 1 })] }, permissions, '2026-10-14 09:00:00');
  assert.deepEqual(bugs.priorities.map(r => r.id), ['2']);
});

test('个人查询明确限定会话用户，各类归属复用负责人／成员关系', async () => {
  const queries = personalSourceQueries('7');
  for (const [, params] of Object.values(queries)) assert.ok(params.every(value => value === '7'));
  assert.match(queries.tasks[0], /pms_task_owner/);
  assert.match(queries.projects[0], /pms_project_member/);
  assert.match(queries.planItems[0], /pms_project_plan_item_collaborator/);
  const queried = [];
  const query = { prepare(sql) { queried.push(sql); return { get: async () => sql.includes('as_of') ? { as_of: '2026-10-14 09:00:00' } : person, all: async () => sql.includes('pms_role_menu') ? [{ path: '/tasks' }] : [] }; } };
  await personalSnapshot('7', query);
  assert.ok(queried.some(sql => sql.includes('FROM pms_task t')));
  assert.ok(!queried.some(sql => sql.includes('FROM pms_project t')));
});

test('个人总结使用本人操作证据与下一步清单，缓存随重点及操作变化失效', async () => {
  const { buildPersonalSummaryEvidence, createSummaryService } = require('../src/services/digitalTwinAiSummary');
  const data = buildPersonalSnapshot(person, { tasks: [row(1)] }, permissions, '2026-10-14 09:00:00');
  let calls = 0;
  const generate = createSummaryService({ readSnapshot: async () => data, buildEvidence: buildPersonalSummaryEvidence, complete: async evidence => { calls++; assert.equal(evidence.scope, 'person'); return { text: '个人工作总结', model: 'test' }; } });
  const evidence = buildPersonalSummaryEvidence(data);
  assert.equal(evidence.currentWork.length, 1);
  assert.equal(evidence.nextSteps.length, 1);
  assert.equal(Object.hasOwn(evidence, 'product'), false);
  await generate('7', 'personal'); await generate('7', 'personal'); assert.equal(calls, 1);
  data.events.push({ name: '任务一', action: '状态变更为已完成', createdAt: '2026-10-14 08:00:00' });
  await generate('7', 'personal'); assert.equal(calls, 2);
});

test('个人接口拒绝非法人员参数和自定义总结输入', async () => {
  const controller = require('../src/controllers/digitalTwinController');
  let status; const res = { status(code) { status = code; return this; }, json(body) { return body; } };
  await controller.personal({ query: { userId: '2' }, user: { id: 1 } }, res, () => assert.fail('不应进入查询'));
  assert.equal(status, 400);
  await controller.personal({ query: { personId: '0' }, user: { id: 1 } }, res, () => assert.fail('不应进入查询'));
  assert.equal(status, 400);
  await controller.personalSummary({ query: {}, body: { personId: '2' } }, res, () => assert.fail('不应生成他人总结'));
  assert.equal(status, 400);
});

test('人员切换按查看者权限查询所选人员，不借用被查看者权限', async () => {
  const calls = [];
  const query = { prepare(sql) { return {
    get: async (...args) => { calls.push([sql, args]); return sql.includes('as_of') ? { as_of: '2026-10-14 09:00:00' } : { id: '8', real_name: '所选人员' }; },
    all: async (...args) => { calls.push([sql, args]); return sql.includes('pms_role_menu') ? [{ path: '/tasks' }] : []; }
  }; } };
  const result = await personalSnapshot('7', query, '8');
  assert.equal(result.person.id, '8');
  assert.deepEqual(calls.find(([sql]) => sql.includes('pms_role_menu'))[1], ['7']);
  assert.deepEqual(calls.find(([sql]) => sql.includes('FROM pms_task t'))[1], ['8']);
  assert.ok(!calls.some(([sql]) => sql.includes('FROM pms_project t')));
});

test('个人工作简报区分当前推进与下一步，暂停和待验证不伪装成正在做', () => {
  const data = buildPersonalSnapshot(person, {
    tasks: [row(1), row(2, { status: 0 }), row(3, { status: 3 }), row(4, { status: 4 }), row(5, { parent_closed: true })],
    projects: [row(6, { relationship: 'participant' })],
    bugs: [row(7, { status: 1, severity: 1 }), row(8, { status: 2 })]
  }, permissions, '2026-10-14 09:00:00');
  assert.deepEqual(data.workBoard.current.map(r => r.id), ['1']);
  assert.deepEqual(new Set(data.workBoard.next.map(r => r.id)), new Set(['1', '2', '3', '7']));
  assert.equal(data.records.find(r => r.id === '3').nextAction, '协调恢复或确认后续安排');
  assert.equal(data.records.find(r => r.id === '7').nextAction, '验证修复结果');
  const evidence = require('../src/services/digitalTwinAiSummary').buildPersonalSummaryEvidence(data);
  assert.deepEqual(evidence.currentWork.map(r => r.name), ['工作1']);
  assert.ok(evidence.nextSteps.some(r => r.nextAction === '验证修复结果'));
});

test('个人AI提炼业务内容，输入描述与本人跟进，不将更新列表当成成果', () => {
  const data = buildPersonalSnapshot(person, { tasks: [row(1, { description: '接入采购公告数据，补齐异常重试与去重校验' })] }, permissions, '2026-10-14 09:00:00');
  data.records[0].progressNote = '已完成数据接入，正在验证重复公告';
  data.events = [{ kind: 'tasks', recordId: '1', name: '工作1', action: '编辑跟进', createdAt: '2026-10-14 08:00:00' }];
  const evidence = require('../src/services/digitalTwinAiSummary').buildPersonalSummaryEvidence(data);
  assert.equal(evidence.currentWork[0].content, '接入采购公告数据，补齐异常重试与去重校验');
  assert.equal(evidence.recentActions[0].reportedProgress, '已完成数据接入，正在验证重复公告');
  assert.equal(Object.hasOwn(evidence, 'recentExamples'), false);
});

test('同一查看者切换人员时总结缓存隔离，后续仍重查所选人员', async () => {
  const { buildPersonalSummaryEvidence, createSummaryService } = require('../src/services/digitalTwinAiSummary');
  let calls = 0;
  const targets = [];
  const generate = createSummaryService({ readSnapshot: async (viewer, target) => {
    assert.equal(viewer, '7'); targets.push(target);
    return buildPersonalSnapshot({ id: target, real_name: `人员${target}` }, { tasks: [row(1)] }, permissions, '2026-10-14 09:00:00');
  }, buildEvidence: buildPersonalSummaryEvidence, complete: async evidence => { calls++; return { text: evidence.person, model: 'test' }; } });
  assert.equal((await generate('7', '8')).text, '人员8');
  assert.equal((await generate('7', '9')).text, '人员9');
  assert.equal((await generate('7', '8')).text, '人员8');
  assert.equal(calls, 2);
  assert.deepEqual(targets, ['8', '9', '8']);
});
