import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const formTemplate = readFileSync(new URL('../src/components/admin/TemplateFormPage/index.tsx', import.meta.url), 'utf8');
const guardHook = readFileSync(new URL('../src/components/admin/TemplateFormPage/useUnsavedChangesGuard.ts', import.meta.url), 'utf8');

test('表单模板统一接入未保存离开保护', () => {
  assert.match(formTemplate, /useUnsavedChangesGuard/);
  assert.match(formTemplate, /onValuesChange/);
  assert.match(formTemplate, /confirmDiscard/);
});

test('离开保护同时覆盖站内路由和刷新关闭', () => {
  assert.match(guardHook, /useBlocker/);
  assert.match(guardHook, /useBeforeUnload/);
  assert.match(guardHook, /当前修改尚未保存/);
});
