import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const read = (relativePath) => fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');

test('登录页、左上角和浏览器页签统一展示智能数管 SIDM', () => {
  const loginPage = read('src/modules/auth/pages/LoginPage.tsx');
  const adminLayout = read('src/layouts/AdminLayout/index.tsx');
  const html = read('index.html');

  assert.match(loginPage, /login-title-text">智能数管</);
  assert.match(loginPage, /login-title-code">SIDM</);
  assert.match(adminLayout, /admin-layout__brand-mark">P</);
  assert.match(adminLayout, /admin-layout__brand-title">智能数管</);
  assert.match(adminLayout, /admin-layout__brand-code">SIDM</);
  assert.match(html, /<title>智能数管 SIDM<\/title>/);
});
