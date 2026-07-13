import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checkDeliveryContract } from './check-delivery-contract.mjs';
import { resolveDeliveryChangeContext } from './delivery-change-context.mjs';
import { getNpmCommandEnv, shouldUseArm64Node } from './npm-command-env.mjs';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const macosUniversalNode = '/usr/local/bin/node';
const runningUnderRosetta = (() => {
  try {
    return execFileSync('sysctl', ['-in', 'sysctl.proc_translated'], { encoding: 'utf8' }).trim() === '1';
  } catch {
    return false;
  }
})();

if (shouldUseArm64Node({
  platform: process.platform,
  arch: process.arch,
  translated: runningUnderRosetta,
  nodeExists: existsSync(macosUniversalNode)
})) {
  const result = spawnSync('arch', ['-arm64', macosUniversalNode, fileURLToPath(import.meta.url)], {
    cwd: rootDir,
    env: { ...process.env, VERIFY_CHANGE_ARM64: '1' },
    stdio: 'inherit'
  });
  process.exit(result.status ?? 1);
}

const npmNodeExecutable = process.platform === 'darwin' && existsSync(macosUniversalNode)
  ? macosUniversalNode
  : process.execPath;
const npmCommandEnv = getNpmCommandEnv(process.env, npmNodeExecutable);
const frontendTests = readdirSync(join(rootDir, 'frontend/test'))
  .filter((name) => /\.test\.(mjs|ts)$/.test(name))
  .sort()
  .map((name) => `test/${name}`);
const commands = [
  { cwd: '.', command: 'node', args: ['--test', 'scripts/check-delivery-contract.test.mjs'] },
  { cwd: '.', command: 'node', args: ['--test', 'scripts/delivery-change-context.test.mjs'] },
  { cwd: 'frontend', command: 'node', args: ['--experimental-strip-types', '--test', ...frontendTests] },
  { cwd: 'frontend', command: 'npm', args: ['run', 'audit:components'] },
  { cwd: 'frontend', command: 'npm', args: ['run', 'audit:components:strict'] },
  { cwd: 'frontend', command: 'npm', args: ['run', 'audit:api-contracts'] },
  { cwd: 'frontend', command: 'npm', args: ['run', 'build'] },
  { cwd: 'backend', command: 'npm', args: ['run', 'audit:operation-history'] },
  { cwd: 'backend', command: 'npm', args: ['test'] }
];

function gitOutput(args) {
  try {
    return execFileSync('git', args, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
  } catch {
    return '';
  }
}

const currentRoutes = readFileSync(join(rootDir, 'frontend/src/app/routes.tsx'), 'utf8');
const hasGitBaseline = Boolean(gitOutput(['rev-parse', '--verify', 'HEAD']).trim());
const { changedFiles, changedRouteRoots } = resolveDeliveryChangeContext({
  currentRoutes,
  baseRoutes: hasGitBaseline ? gitOutput(['show', 'HEAD:frontend/src/app/routes.tsx']) : currentRoutes,
  statusOutput: hasGitBaseline ? gitOutput(['status', '--porcelain']) : '',
  hasGitBaseline
});
const errors = checkDeliveryContract(rootDir, { changedFiles, changedRouteRoots });
if (errors.length) {
  console.error(`交付结构检查失败：\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

for (const { cwd, command, args } of commands) {
  const result = spawnSync(command, args, {
    cwd: join(rootDir, cwd),
    stdio: 'inherit',
    env: command === 'npm' ? npmCommandEnv : process.env
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log('自动门禁通过；数据库迁移与发布仍需人工确认后执行。');
