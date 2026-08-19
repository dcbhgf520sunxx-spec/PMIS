import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function write(target, content) {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

test('keeps previous hashed assets without overwriting the new build', () => {
  const work = mkdtempSync(join(tmpdir(), 'pmis-release-cache-'));
  const previous = join(work, 'previous');
  const next = join(work, 'next');
  write(join(previous, 'assets', 'TaskDetailPage-old.js'), 'old chunk');
  write(join(previous, 'assets', 'shared.js'), 'old shared');
  write(join(previous, 'assets', 'two-releases-ago.js'), 'expired chunk');
  write(join(previous, 'assets', '._ignored.js'), 'apple double');
  write(join(previous, '.pmis-retained-assets'), 'two-releases-ago.js\n');
  write(join(next, 'assets', 'TaskDetailPage-new.js'), 'new chunk');
  write(join(next, 'assets', 'shared.js'), 'new shared');

  const script = join(root, 'deploy', 'retain-previous-frontend-assets.sh');
  assert.equal(existsSync(script), true, '缺少旧版静态资源保留脚本');
  execFileSync('bash', [script, previous, next]);

  assert.equal(readFileSync(join(next, 'assets', 'TaskDetailPage-old.js'), 'utf8'), 'old chunk');
  assert.equal(readFileSync(join(next, 'assets', 'TaskDetailPage-new.js'), 'utf8'), 'new chunk');
  assert.equal(readFileSync(join(next, 'assets', 'shared.js'), 'utf8'), 'new shared');
  assert.equal(existsSync(join(next, 'assets', 'two-releases-ago.js')), false);
  assert.equal(existsSync(join(next, 'assets', '._ignored.js')), false);
});

test('reloads once when a Vite dynamic chunk from an older release is missing', async () => {
  const modulePath = join(root, 'frontend', 'src', 'app', 'chunkLoadRecovery.ts');
  assert.equal(existsSync(modulePath), true, '缺少动态分包加载恢复模块');
  const { installChunkLoadRecovery } = await import(pathToFileURL(modulePath).href);
  const listeners = new Map();
  const values = new Map();
  let reloadCount = 0;
  let prevented = 0;
  const target = {
    addEventListener(name, listener) { listeners.set(name, listener); },
    sessionStorage: {
      getItem(key) { return values.get(key) ?? null; },
      setItem(key, value) { values.set(key, value); }
    },
    location: { reload() { reloadCount += 1; } }
  };

  installChunkLoadRecovery(target, () => 1_000);
  const listener = listeners.get('vite:preloadError');
  assert.equal(typeof listener, 'function');
  listener({
    payload: new TypeError('Failed to fetch dynamically imported module'),
    preventDefault() { prevented += 1; }
  });
  listener({
    payload: new TypeError('Failed to fetch dynamically imported module'),
    preventDefault() { prevented += 1; }
  });

  assert.equal(reloadCount, 1);
  assert.equal(prevented, 2);
});

test('installs dynamic chunk recovery before rendering the application', () => {
  const main = readFileSync(join(root, 'frontend', 'src', 'main.tsx'), 'utf8');
  assert.match(main, /installChunkLoadRecovery\(\);/);
  assert.ok(main.indexOf('installChunkLoadRecovery();') < main.indexOf('ReactDOM.createRoot'));
});
