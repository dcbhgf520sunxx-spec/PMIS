import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveDeliveryChangeContext } from './delivery-change-context.mjs';

test('treats an exported project without Git history as its own baseline', () => {
  const context = resolveDeliveryChangeContext({
    currentRoutes: "{ path: 'orders', element: <Orders /> }",
    hasGitBaseline: false
  });

  assert.deepEqual(context, { changedFiles: [], changedRouteRoots: [] });
});

test('reports routes and files added after an existing Git baseline', () => {
  const context = resolveDeliveryChangeContext({
    currentRoutes: "{ path: 'orders', element: <Orders /> }\n{ path: 'users', element: <Users /> }",
    baseRoutes: "{ path: 'orders', element: <Orders /> }",
    statusOutput: '?? backend/db/migrations/add-users.sql\n',
    hasGitBaseline: true
  });

  assert.deepEqual(context, {
    changedFiles: ['backend/db/migrations/add-users.sql'],
    changedRouteRoots: ['/users']
  });
});

test('统一门禁读取中文文档路径时禁用 Git 引号转义', () => {
  const source = readFileSync(new URL('./verify-change.mjs', import.meta.url), 'utf8');
  assert.match(source, /execFileSync\('git', \['-c', 'core\.quotePath=false', \.\.\.args\]/);
});

test('includes files already committed on the current branch', () => {
  const context = resolveDeliveryChangeContext({
    currentRoutes: "{ path: 'orders', element: <Orders /> }\n{ path: 'users', element: <Users /> }",
    baseRoutes: "{ path: 'orders', element: <Orders /> }",
    diffOutput: [
      'frontend/src/app/routes.tsx',
      'backend/db/migrations/20260716_add_users.sql'
    ].join('\n'),
    statusOutput: '',
    hasGitBaseline: true
  });

  assert.deepEqual(context, {
    changedFiles: [
      'frontend/src/app/routes.tsx',
      'backend/db/migrations/20260716_add_users.sql'
    ],
    changedRouteRoots: ['/users']
  });
});

test('remote verification checks out history and supplies the previous revision', () => {
  const workflow = readFileSync(new URL('../.github/workflows/verify.yml', import.meta.url), 'utf8');
  const verify = readFileSync(new URL('./verify-change.mjs', import.meta.url), 'utf8');

  assert.match(workflow, /fetch-depth:\s*0/);
  assert.match(workflow, /DELIVERY_BASE_SHA:\s*\$\{\{ github\.event\.pull_request\.base\.sha \|\| github\.event\.before \}\}/);
  assert.match(verify, /process\.env\.DELIVERY_BASE_SHA/);
  assert.match(verify, /'diff', '--name-only', '--diff-filter=ACMR'/);
});
