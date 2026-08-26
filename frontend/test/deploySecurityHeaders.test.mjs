import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('生产 CSP 同时允许附件 blob 预览和 Agent iframe', () => {
  const nginx = fs.readFileSync(path.join(repoRoot, 'deploy/nginx.conf'), 'utf8');
  const csp = nginx.match(/add_header Content-Security-Policy "([^"]+)" always;/)?.[1] ?? '';

  assert.match(csp, /frame-src\s+'self'\s+blob:\s+https:\/\/ai\.znjs\.com:3100;/);
});
