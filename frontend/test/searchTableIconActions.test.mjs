import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const table = read('src/components/admin/SearchTable/index.tsx');
const styles = read('src/components/admin/SearchTable/index.css');

test('表格设置入口和重置列宽统一调用公共图标按钮', () => {
  assert.match(table, /import \{ AdminIconAction \} from '\.\.\/AdminIconAction'/);
  assert.match(table, /<AdminIconAction[\s\S]*label="重置列宽"/);
  assert.match(table, /<AdminIconAction[\s\S]*label="表格设置"/);
  assert.doesNotMatch(table, /<Button[\s\S]*admin-table-settings-(?:trigger|popover__reset)/);
});

test('ProTable 内置工具按钮由 SearchTable 统一为正方形浅蓝悬浮样式', () => {
  assert.match(styles, /\.admin-table-settings-popover__item\s*\{[\s\S]*width:\s*24px/);
  assert.match(styles, /\.admin-table-settings-popover__item\s*\{[\s\S]*height:\s*24px/);
  assert.match(styles, /\.admin-table-settings-popover__item:hover\s*\{[\s\S]*background:\s*var\(--app-soft-primary-bg\)\s*!important/);
  assert.match(styles, /\.admin-table-settings-popover__item\s*>\s*\*/);
});

test('列设置使用组件工作台约定的表格图标', () => {
  assert.match(table, /import \{[^}]*TableOutlined[^}]*\} from '@ant-design\/icons'/);
  assert.match(table, /setting:\s*\{\s*settingIcon:\s*<TableOutlined\s*\/>\s*\}/);
});
