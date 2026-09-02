import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/modules/task/statusTransitions.ts', 'utf8');

test('任务暂停后可以恢复到任意其他状态', () => {
  assert.match(source, /r\.status\s*===\s*3[\s\S]*return\s*\[\s*0\s*,\s*1\s*,\s*2\s*\]/);
});

test('任务状态筛选和状态变更使用列表展示的统一文案', () => {
  assert.match(source, /taskStatusLabels[\s\S]*0:'待处理'[\s\S]*1:'处理中'[\s\S]*2:'已完成'[\s\S]*3:'已暂停'/);
});
