import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/components/admin/TemplateFormPage/index.tsx', 'utf8');
const gate = readFileSync('../scripts/verify-change.mjs', 'utf8');

test('表单模板复用 PageShell 加载层，避免嵌套 Spin 撑高后无法滚动', () => {
  assert.match(source, /<PageShell[\s\S]*loading=\{Boolean\(loading\)\}/);
  assert.doesNotMatch(source, /<Spin\b/);
});

test('长表单滚动回归测试进入统一门禁', () => {
  assert.match(gate, /readdirSync/);
  assert.match(gate, /frontendTests/);
});

test('表单模板自动回填结构化字段错误并滚动到首个字段', () => {
  assert.match(source, /applyApiFieldErrors/);
  assert.match(source, /scrollToField/);
  assert.match(source, /fieldNameMap/);
});
