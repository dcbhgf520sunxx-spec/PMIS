import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessBackendRuntimeFreshness } from './backend-runtime-freshness.mjs';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const backendDir = join(rootDir, 'backend');
const backendSourceDir = join(backendDir, 'src');

function commandOutput(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

function backendPort() {
  if (process.env.BACKEND_PORT) return process.env.BACKEND_PORT;
  const envFile = join(backendDir, '.env');
  const envSource = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
  return envSource.match(/^PORT\s*=\s*([^\s#]+)/m)?.[1] || '3101';
}

function latestMtimeMs(directory) {
  let latest = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    latest = Math.max(latest, entry.isDirectory() ? latestMtimeMs(path) : statSync(path).mtimeMs);
  }
  return latest;
}

const port = backendPort();
const listenerPid = commandOutput('lsof', [`-tiTCP:${port}`, '-sTCP:LISTEN']).split(/\s+/).filter(Boolean)[0] || null;

if (!listenerPid) {
  console.log(assessBackendRuntimeFreshness({ listenerPid }).message);
  process.exit(0);
}

const processStartSource = commandOutput('ps', ['-p', listenerPid, '-o', 'lstart=']);
const processStartMs = Date.parse(processStartSource);
if (!Number.isFinite(processStartMs)) {
  console.error(`无法读取 ${port} 端口后端进程的启动时间，运行态新鲜度检查失败`);
  process.exit(1);
}

const result = assessBackendRuntimeFreshness({
  listenerPid,
  processStartMs,
  latestSourceMtimeMs: latestMtimeMs(backendSourceDir)
});

if (result.status === 'stale') {
  console.error(`运行态新鲜度检查失败：${result.message}`);
  process.exit(1);
}

console.log(result.message);
