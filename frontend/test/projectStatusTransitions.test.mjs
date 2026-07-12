import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const frontend = readFileSync('src/modules/project/statusTransitions.ts', 'utf8');
const backend = readFileSync('../backend/src/services/productProjectRules.js', 'utf8');

test('项目状态矩阵覆盖正常流转、暂停和恢复', () => {
  assert.match(frontend, /0:\s*\[1, 3\]/);
  assert.match(frontend, /1:\s*\[2, 3\]/);
  assert.match(frontend, /2:\s*\[3\]/);
  assert.match(frontend, /previousStatus/);
  assert.match(backend, /allowedProjectStatuses/);
});

test('项目完成和暂停要求附加日期字段', () => {
  assert.match(backend, /actual_end_date/);
  assert.match(backend, /suspend_date/);
});
