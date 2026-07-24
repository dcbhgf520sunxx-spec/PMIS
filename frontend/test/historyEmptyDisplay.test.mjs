import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(file, 'utf8');

test('公共变更历史把旧“空”字符串统一展示为短横线', () => {
  const timeline = read('src/components/admin/HistoryTimeline/index.tsx');
  assert.match(timeline, /value === ['"]空['"]/);
});

test('业务控制器不再把真正空值写成“空”字符串', () => {
  const controllers = [
    '../backend/src/controllers/workOrderController.js',
    '../backend/src/controllers/userController.js',
    '../backend/src/controllers/roleController.js'
  ].map(read).join('\n');

  assert.doesNotMatch(controllers, /\?\?\s*['"]空['"]/);
});
