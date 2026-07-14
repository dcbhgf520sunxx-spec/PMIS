import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const loginPage = readFileSync(new URL('../src/modules/auth/pages/LoginPage.tsx', import.meta.url), 'utf8');
const adminLayout = readFileSync(new URL('../src/layouts/AdminLayout/index.tsx', import.meta.url), 'utf8');
const pageNavigation = readFileSync(new URL('../src/components/admin/PageNavigation/pageNavigation.ts', import.meta.url), 'utf8');

test('登录成功后始终进入用户偏好设置的默认页面', () => {
  assert.match(loginPage, /navigate\(preference\.default_route \|\| '\/home', \{ replace: true \}\)/);
  assert.doesNotMatch(loginPage, /stateReturnTo|consumeLoginReturnTo/);
  assert.doesNotMatch(adminLayout, /saveLoginReturnTo/);
  assert.doesNotMatch(pageNavigation, /LOGIN_RETURN_KEY|consumeLoginReturnTo|saveLoginReturnTo/);
});
