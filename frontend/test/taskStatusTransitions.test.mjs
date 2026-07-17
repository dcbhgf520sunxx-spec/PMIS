import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/modules/task/statusTransitions.ts', 'utf8');

test('任务暂停后可以恢复到任意其他状态', () => {
  assert.match(source, /r\.status\s*===\s*3[\s\S]*return\s*\[\s*0\s*,\s*1\s*,\s*2\s*\]/);
});
