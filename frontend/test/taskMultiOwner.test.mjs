import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('任务表单使用现有多选组件提交 owner_ids', () => {
  const form = read('src/modules/task/pages/TaskFormPage.tsx');
  const api = read('src/api/taskApi.ts');

  assert.match(form, /name="ownerIds"[\s\S]*?mode="multiple"/);
  assert.match(api, /owner_ids:\s*values\.ownerIds\.map\(Number\)/);
  assert.doesNotMatch(api, /owner_id:\s*Number\(values\.ownerId\)/);
});

test('任务列表详情和子任务展示全部负责人', () => {
  const list = read('src/modules/task/pages/TaskListPage.tsx');
  const detail = read('src/modules/task/pages/TaskDetailPage.tsx');
  const types = read('src/modules/task/types.ts');

  assert.match(types, /owners:\s*TaskOwner\[\]/);
  assert.match(types, /ownerIds:\s*string\[\]/);
  assert.match(list, /ownerNames/);
  assert.match(detail, /ownerNames/);
});

test('任务批量指派支持搜索并选择多个平级负责人', () => {
  const batch = read('src/modules/task/pages/useTaskBatchActions.tsx');
  const api = read('src/api/taskApi.ts');

  assert.match(batch, /mode="multiple"/);
  assert.match(batch, /assignTargets/);
  assert.match(api, /batchAssignTasks\(ids: string\[\], ownerIds: string\[\]\)/);
});
