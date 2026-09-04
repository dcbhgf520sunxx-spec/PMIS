import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');

test('BUG 前端状态矩阵与后端一致', () => {
  const source = read('src/modules/bug/statusTransitions.ts');
  assert.match(source, /0:\s*\[1,\s*2\]/);
  assert.match(source, /1:\s*\[2,\s*3\]/);
  assert.match(source, /2:\s*\[3\]/);
  assert.match(source, /3:\s*\[1\]/);
});

test('BUG 状态操作复用公共组件并要求处理字段', () => {
  const source = read('src/modules/bug/components/BugStatusChangeAction.tsx');
  assert.match(source, /StatusChangeAction/);
  assert.match(source, /修复时间/);
  assert.match(source, /关闭时间/);
  assert.match(source, /解决方案/);
  assert.match(source, /resolutionOptions/);
  assert.match(source, /userOptions/);
  assert.match(source, /defaultAssigneeId/);
  assert.match(source, /name="assigneeId"/);
  assert.match(source, /label="指派人"/);
  assert.match(source, /target === 3/);
  assert.match(source, /name="activationReason"/);
  assert.match(source, /label="激活原因"/);
  assert.match(source, /target === 3[^\n]+name="assigneeId"[^\n]+label="指派人"/);
  assert.match(source, /required:\s*true/);
  assert.match(source, /maxLength[=:]\s*\{?100\}?/);
  assert.match(source, /AdminTextArea/);
  assert.match(source, /rows=\{4\}/);
});

test('BUG 状态变更的附加字段全部不回填旧值', () => {
  const source = read('src/modules/bug/components/BugStatusChangeAction.tsx');
  assert.doesNotMatch(source, /resolvedTime:\s*bug\.resolvedTime/);
  assert.doesNotMatch(source, /resolutionId:\s*bug\.resolutionId/);
  assert.doesNotMatch(source, /closedTime:\s*bug\.closedTime/);
  assert.doesNotMatch(source, /activationReason:\s*bug\.activationReason/);
  assert.doesNotMatch(source, /\sformValues=/);
});

test('BUG API 读写激活原因、创建人和修复后指派人', () => {
  const source = read('src/api/bugApi.ts');
  assert.match(source, /activation_reason/);
  assert.match(source, /activationReason/);
  assert.match(source, /creator_id/);
  assert.match(source, /creatorId/);
  assert.match(source, /assignee_id:\s*extra\.assigneeId/);
});

test('BUG 单条修复默认指派创建人，批量修复不自动套用首条创建人', () => {
  const list = read('src/modules/bug/pages/BugListPage.tsx');
  const detail = read('src/modules/bug/pages/BugDetailPage.tsx');
  assert.match(list, /defaultAssigneeId=\{row\.creatorId\}/);
  assert.match(detail, /defaultAssigneeId=\{row\.creatorId\}/);
  const batch = list.slice(list.indexOf('batch={{'));
  assert.doesNotMatch(batch, /defaultAssigneeId=/);
});

test('BUG 状态变更把指派人放在其他附加字段之前', () => {
  const source = read('src/modules/bug/components/BugStatusChangeAction.tsx');
  const fixedAssignee = source.indexOf('target === 1 ? <AdminFormItem name="assigneeId"');
  const resolvedTime = source.indexOf('target === 1 ? <AdminFormItem name="resolvedTime"');
  const activatedAssignee = source.indexOf('target === 3 ? <AdminFormItem name="assigneeId"');
  const activationReason = source.indexOf('target === 3 ? <AdminFormItem name="activationReason"');
  assert.ok(fixedAssignee >= 0 && fixedAssignee < resolvedTime);
  assert.ok(activatedAssignee >= 0 && activatedAssignee < activationReason);
});
