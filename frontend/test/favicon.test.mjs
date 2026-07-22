import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('浏览器标签图标使用版本化地址避免旧图标缓存', () => {
  const html = fs.readFileSync(path.join(frontendRoot, 'index.html'), 'utf8');

  assert.match(html, /<link rel="icon" type="image\/png" href="\/favicon\.png\?v=\d{8}" \/>/);
});
