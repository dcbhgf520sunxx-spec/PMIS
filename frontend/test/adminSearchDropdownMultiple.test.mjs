import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('搜索动作下拉支持多选后一次进入确认流程', () => {
  const component = read('src/components/admin/AdminSearchDropdown/index.tsx');
  const taskBatch = read('src/modules/task/pages/useTaskBatchActions.tsx');

  assert.match(component, /multiple:\s*true/);
  assert.match(component, /onConfirm:\s*\(values:\s*string\[\]\)/);
  assert.match(component, /admin-search-dropdown__footer/);
  assert.match(taskBatch, /<AdminSearchDropdown[\s\S]*?multiple/);
  assert.match(taskBatch, /onConfirm=\{\(values\)/);
  assert.doesNotMatch(taskBatch, /AdminFormItem|AdminSelect/);
});

test('组件工作台展示搜索多选动作入口', () => {
  const demo = read('src/modules/design-system/pages/sections/input/SelectionInputExamples.tsx');

  assert.match(demo, /ComponentEntry name="AdminSearchDropdown"/);
  assert.match(demo, /<AdminSearchDropdown[\s\S]*?multiple/);
});
