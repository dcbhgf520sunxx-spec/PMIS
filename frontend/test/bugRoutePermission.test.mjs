import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routes = readFileSync(new URL('../src/app/routes.tsx', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/layouts/AdminLayout/index.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../backend/src/app.js', import.meta.url), 'utf8');

test('BUG 列表、新增、复制、编辑和详情路由均已接入', () => {
  assert.match(routes, /modules\/bug\/pages\/BugListPage/);
  assert.match(routes, /path: 'bugs'/);
  assert.match(routes, /path: 'bugs\/new'/);
  assert.match(routes, /path: 'bugs\/:id\/copy'/);
  assert.match(routes, /path: 'bugs\/:id\/edit'/);
  assert.match(routes, /path: 'bugs\/:id'/);
});

test('BUG 菜单位于任务管理之后并复用统一权限键', () => {
  assert.match(layout, /BugOutlined/);
  assert.match(layout, /key: '\/bugs'[\s\S]*label: 'BUG管理'/);
  assert.ok(layout.indexOf("key: '/tasks'") < layout.indexOf("key: '/bugs'"));
  assert.match(app, /checkPermission\('\/bugs'\)/);
});
