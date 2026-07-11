import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const layoutSource = readFileSync('src/layouts/AdminLayout/index.tsx', 'utf8');
const schemaSource = readFileSync('../backend/db/init/001_schema.sql', 'utf8');

test('组件工作台不再使用管理员写死菜单', () => {
  assert.doesNotMatch(layoutSource, /adminOnlyMenuItems/);
  assert.doesNotMatch(layoutSource, /isAdminOnlyPage/);
});

test('组件工作台全部子菜单进入权限声明', () => {
  for (const code of [
    'design_system_overview',
    'design_system_samples',
    'design_system_foundation',
    'design_system_layout',
    'design_system_base',
    'design_system_input',
    'design_system_feedback',
    'design_system_display'
  ]) {
    assert.match(schemaSource, new RegExp(code));
  }
  assert.match(layoutSource, /location\.search/);
  assert.match(layoutSource, /selectedCategory = isDesignCategory\(category\) \? category : 'overview'/);
  assert.match(layoutSource, /`\/system\/design-system\?category=\$\{selectedCategory\}`/);
});

test('基础设置位于用户权限上方且组件工作台最后', () => {
  assert.ok(layoutSource.indexOf("key: 'base_settings'") < layoutSource.indexOf("key: 'user_auth'"));
  assert.ok(layoutSource.indexOf("key: 'user_auth'") < layoutSource.indexOf("key: 'design_system'"));
  assert.match(schemaSource, /'base_settings'[\s\S]*?, 20,/);
  assert.match(schemaSource, /'user_auth'[\s\S]*?, 30,/);
  assert.match(schemaSource, /'design_system'[\s\S]*?, 40,/);
});
