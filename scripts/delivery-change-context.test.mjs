import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkDeliveryContract } from './check-delivery-contract.mjs';
import { readDeliveryDiff, readDeliveryGitOutput, resolveDeliveryChangeContext } from './delivery-change-context.mjs';

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

test('does not treat the shared authenticated release-notes page as a new business menu', () => {
  const context = resolveDeliveryChangeContext({
    currentRoutes: "{ path: 'orders', element: <Orders /> }\n{ path: 'release-notes', element: <ReleaseNotes /> }",
    baseRoutes: "{ path: 'orders', element: <Orders /> }",
    hasGitBaseline: true
  });

  assert.deepEqual(context.changedRouteRoots, []);
});

test('recognizes Chinese document paths in committed and working-tree changes', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'delivery-chinese-paths-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    git('init', '--quiet');
    git('config', 'user.name', 'Delivery regression');
    git('config', 'user.email', 'delivery-test@example.invalid');
    git('config', 'core.quotePath', 'true');
    git('commit', '--quiet', '--allow-empty', '-m', 'baseline');
    const base = git('rev-parse', 'HEAD').trim();
    const files = ['docs/数据库表结构.md', 'docs/数据库表结构.xlsx'];
    mkdirSync(join(cwd, 'docs'));
    for (const file of files) writeFileSync(join(cwd, file), 'filename fixture');
    git('add', 'docs');
    git('commit', '--quiet', '-m', 'database documentation');
    writeFileSync(join(cwd, files[0]), 'working-tree change');
    const context = resolveDeliveryChangeContext({
      currentRoutes: '',
      hasGitBaseline: true,
      diffOutput: readDeliveryGitOutput(cwd, ['diff', '--name-only', '--diff-filter=ACMR', base, 'HEAD']),
      statusOutput: readDeliveryGitOutput(cwd, ['status', '--porcelain'])
    });
    assert.deepEqual(context.changedFiles, files);
    assert.equal(git('config', 'core.quotePath').trim(), 'true');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
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
  assert.match(verify, /readDeliveryDiff\(rootDir, baseRevision\)/);
});

test('a committed runtime-file deletion still requires an updated release record', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'delivery-deleted-runtime-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const file = 'frontend/src/removed-feature.ts';
  try {
    git('init', '--quiet');
    git('config', 'user.name', 'Delivery regression');
    git('config', 'user.email', 'delivery-test@example.invalid');
    mkdirSync(join(cwd, 'frontend/src'), { recursive: true });
    writeFileSync(join(cwd, file), 'export const feature = true;');
    git('add', '.');
    git('commit', '--quiet', '-m', 'baseline');
    const base = git('rev-parse', 'HEAD').trim();
    git('rm', file);
    git('commit', '--quiet', '-m', 'remove feature');
    const context = resolveDeliveryChangeContext({
      currentRoutes: '', hasGitBaseline: true, diffOutput: readDeliveryDiff(cwd, base)
    });
    assert.deepEqual(context.changedFiles, [file]);
    const projectDir = fileURLToPath(new URL('..', import.meta.url));
    const errors = checkDeliveryContract(projectDir, context);
    assert.ok(errors.includes('产品代码已变更，但未同步更新版本发布记录'));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
