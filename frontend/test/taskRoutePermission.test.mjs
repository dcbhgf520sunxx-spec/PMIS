import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routes = readFileSync(new URL('../src/app/routes.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../backend/src/app.js', import.meta.url), 'utf8');

test('子任务新增路由接入任务表单并继承任务权限', () => {
  assert.match(routes, /path: 'tasks\/:id\/subtasks\/new'/);
  assert.match(routes, /TaskFormPage mode="create-subtask"/);
  assert.match(app, /app\.use\('\/api\/tasks', verifyToken, checkPermission\('\/tasks'\)/);
});
