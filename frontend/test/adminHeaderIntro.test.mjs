import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/layouts/AdminLayout/index.tsx', 'utf8');
const rules = readFileSync('../docs/ai-development-rules.md', 'utf8');

test('除组件工作台外顶部欢迎语保持唯一统一契约', () => {
  assert.match(source, /const DEFAULT_HEADER_SUBTITLE = '欢迎回来，今天也请从容处理每一项工作。'/);
  assert.doesNotMatch(source, /pathname\.startsWith\('\/home'\)/);
  assert.doesNotMatch(source, /pathname\.startsWith\('\/samples\/work-order'\)/);
  assert.match(source, /pathname\.startsWith\('\/system\/design-system'\)/);
  assert.match(source, /title: ''[\s\S]*subtitle: DEFAULT_HEADER_SUBTITLE/);
});

test('开发规则禁止业务页面自行配置顶部标题或欢迎语', () => {
  assert.match(rules, /除组件工作台外.*欢迎回来，今天也请从容处理每一项工作。/);
  assert.match(rules, /不得按业务模块自定义顶部标题或文案/);
});
