import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkDeliveryContract } from './check-delivery-contract.mjs';

function write(root, file, content) {
  const target = join(root, file);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, content);
}

function createProject({ sidebar = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'delivery-contract-'));
  write(root, 'AGENTS.md', '所有业务变更必须遵守 docs/ai-delivery-flow.md。');
  write(root, 'docs/ai-delivery-flow.md', '业务接口必须同时挂载 `verifyToken` 和 `checkPermission`。');
  write(root, 'frontend/src/app/routes.tsx', "{ path: 'orders', element: <Orders /> }");
  write(root, 'frontend/src/layouts/AdminLayout/index.tsx', sidebar ? "{ key: '/orders', label: '订单' }" : 'const menu = [];');
  write(root, 'backend/src/routes/orders.js', 'module.exports = {}');
  write(root, 'backend/src/app.js', [
    "const ordersRoutes = require('./routes/orders')",
    "app.use('/api/orders', verifyToken, checkPermission('/orders'), ordersRoutes)"
  ].join('\n'));
  write(root, 'backend/db/init/001_schema.sql', "INSERT INTO pms_menu (path) VALUES ('/orders');");
  write(root, 'deploy/README.md', 'PostgreSQL 16\nReact/Vite');
  write(root, 'deploy/nginx.conf', 'try_files $uri $uri/ /index.html;');
  return root;
}

test('accepts a documented business route with matching menu and permission path', () => {
  assert.deepEqual(checkDeliveryContract(createProject()), []);
});

test('reports a business route that has no sidebar menu', () => {
  const errors = checkDeliveryContract(createProject({ sidebar: false }));
  assert.ok(errors.includes('业务路由 /orders 未配置侧栏菜单'));
});

test('uses the list route menu for nested create and detail routes', () => {
  const root = createProject();
  write(root, 'frontend/src/app/routes.tsx', [
    "{ path: 'orders', element: <Orders /> },",
    "{ path: 'orders/new', element: <OrderForm /> },",
    "{ path: 'orders/:id', element: <OrderDetail /> }"
  ].join('\n'));

  assert.deepEqual(checkDeliveryContract(root), []);
});

test('allows deployment text that explicitly says MySQL is not used', () => {
  const root = createProject();
  write(root, 'deploy/README.md', 'PostgreSQL 16\nReact/Vite\n数据库为 PostgreSQL，不使用 MySQL。');

  assert.deepEqual(checkDeliveryContract(root), []);
});

test('reports a route module that is not mounted in app.js', () => {
  const root = createProject();
  write(root, 'backend/src/app.js', "const ordersRoutes = require('./routes/orders')");

  assert.ok(checkDeliveryContract(root).includes('后端路由 orders.js 未在 app.js 挂载'));
});

test('requires a migration when a new business route is added', () => {
  const root = createProject();
  const errors = checkDeliveryContract(root, { changedRouteRoots: ['/orders'] });

  assert.ok(errors.includes('新增业务路由 /orders 未同时新增 migration'));
});

test('requires the new route path inside its migration', () => {
  const root = createProject();
  write(root, 'backend/db/migrations/20260710_orders.sql', 'SELECT 1;');
  const errors = checkDeliveryContract(root, {
    changedRouteRoots: ['/orders'],
    changedFiles: ['backend/db/migrations/20260710_orders.sql']
  });

  assert.ok(errors.includes('新增业务路由 /orders 的 migration 未写入对应 pms_menu.path'));
});

test('reports a business API that only checks login', () => {
  const root = createProject();
  write(root, 'backend/src/routes/invoices.js', 'module.exports = {}');
  write(root, 'backend/src/app.js', [
    "const ordersRoutes = require('./routes/orders')",
    "const invoicesRoutes = require('./routes/invoices')",
    "app.use('/api/orders', verifyToken, checkPermission('/orders'), ordersRoutes)",
    "app.use('/api/invoices', verifyToken, invoicesRoutes)"
  ].join('\n'));

  assert.ok(checkDeliveryContract(root).includes('业务接口 /api/invoices 缺少 checkPermission'));
});

test('reports a business API that does not check login', () => {
  const root = createProject();
  write(root, 'backend/src/app.js', [
    "const ordersRoutes = require('./routes/orders')",
    "app.use('/api/orders', ordersRoutes)"
  ].join('\n'));

  assert.ok(checkDeliveryContract(root).includes('业务接口 /api/orders 缺少 verifyToken'));
});

test('allows explicit public and login-only shared APIs', () => {
  const root = createProject();
  write(root, 'backend/src/app.js', [
    "const authRoutes = require('./routes/auth')",
    "const ordersRoutes = require('./routes/orders')",
    "const messageRoutes = require('./routes/messages')",
    "app.use('/api/auth', authRoutes)",
    "app.get('/api/health', healthController)",
    "app.get('/api/user-options', verifyToken, userController.options)",
    "app.get('/api/role-options', verifyToken, roleController.options)",
    "app.get('/api/archive-options/by-type-name', verifyToken, archiveController.getByTypeName)",
    "app.use('/api/messages', verifyToken, messageRoutes)",
    "app.use('/api/orders', verifyToken, checkPermission('/orders'), ordersRoutes)"
  ].join('\n'));

  assert.deepEqual(checkDeliveryContract(root), []);
});

test('requires login middleware to run before permission middleware', () => {
  const root = createProject();
  write(root, 'backend/src/app.js', [
    "const ordersRoutes = require('./routes/orders')",
    "app.use('/api/orders', checkPermission('/orders'), verifyToken, ordersRoutes)"
  ].join('\n'));

  assert.ok(checkDeliveryContract(root).includes('业务接口 /api/orders 的 verifyToken 必须在 checkPermission 之前'));
});

test('does not allow multiline formatting to hide missing API middleware', () => {
  const root = createProject();
  write(root, 'backend/src/app.js', [
    "const ordersRoutes = require('./routes/orders')",
    'app.use(',
    "  '/api/orders', ordersRoutes",
    ')'
  ].join('\n'));

  assert.ok(checkDeliveryContract(root).includes('业务接口 /api/orders 缺少 verifyToken'));
});

test('requires the AI delivery flow to state the API permission rule', () => {
  const root = createProject();
  write(root, 'docs/ai-delivery-flow.md', '# flow');

  assert.ok(checkDeliveryContract(root).includes('AI 交付流程未声明业务接口双重鉴权规则'));
});
