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
  assert.match(source, /target === 3/);
  assert.match(source, /name="activationReason"/);
  assert.match(source, /label="激活原因"/);
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

test('BUG API 读写激活原因', () => {
  const source = read('src/api/bugApi.ts');
  assert.match(source, /activation_reason/);
  assert.match(source, /activationReason/);
});
