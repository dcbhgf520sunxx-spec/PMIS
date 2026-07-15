import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const frontend = readFileSync('src/modules/project/statusTransitions.ts', 'utf8');
const backend = readFileSync('../backend/src/services/productProjectRules.js', 'utf8');

test('项目状态矩阵允许任何状态暂停且暂停可转为任意其他状态', () => {
  assert.match(frontend, /0:\s*\[1, 3\]/);
  assert.match(frontend, /1:\s*\[2, 3\]/);
  assert.match(frontend, /2:\s*\[3\]/);
  assert.match(frontend, /project\.status === 3[\s\S]*\[0, 1, 2\]/);
  assert.match(backend, /allowedProjectStatuses/);
});

test('项目完成和暂停要求附加日期字段', () => {
  assert.match(backend, /actual_end_date/);
  assert.match(backend, /suspend_date/);
});

test('暂停转完成时弹窗不带出已有完成时间', () => {
  const action = readFileSync('src/modules/project/components/ProjectStatusChangeAction.tsx', 'utf8');
  assert.doesNotMatch(action, /\sformValues=/);
  assert.doesNotMatch(action, /dayjs\(project\.actualEndDate\)/);
});

test('完成转暂停保留完成时间，暂停转非完成清空完成时间', () => {
  const controller = readFileSync('../backend/src/controllers/projectController.js', 'utf8');
  assert.match(controller, /Number\(old\.status\) === 2 && status === 3[\s\S]*old\.actual_end_date/);
  assert.match(controller, /:\s*null/);
});
