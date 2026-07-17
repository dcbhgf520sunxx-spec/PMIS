import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const modalUrl = new URL('../src/modules/account/components/PasswordChangeModal.tsx', import.meta.url);
const loginPage = readFileSync(new URL('../src/modules/auth/pages/LoginPage.tsx', import.meta.url), 'utf8');
const authStore = readFileSync(new URL('../src/stores/authStore.ts', import.meta.url), 'utf8');
const adminLayout = readFileSync(new URL('../src/layouts/AdminLayout/index.tsx', import.meta.url), 'utf8');
const passwordModal = existsSync(modalUrl) ? readFileSync(modalUrl, 'utf8') : '';

function assertLogoutCompletesBeforeAuthClear(source, expectedCount) {
  const matches = source.match(/await logoutAccessSession\([\s\S]*?\)\.catch\(\(\) => undefined\);\s*clearAuth\(\);/g) || [];
  assert.equal(matches.length, expectedCount);
}

test('首次登录必须完成改密后才能进入业务页面', () => {
  assert.match(loginPage, /result\.first_login === 1/);
  assert.match(loginPage, /<PasswordChangeModal[\s\S]*forced/);
  assert.match(authStore, /mustChangePassword/);
  assert.match(adminLayout, /if \(mustChangePassword\)[\s\S]*<Navigate to="\/login" replace/);
});

test('首次登录改密弹窗不能被关闭或绕过', () => {
  assert.match(passwordModal, /closable=\{!forced\}/);
  assert.match(passwordModal, /maskClosable=\{!forced\}/);
  assert.match(passwordModal, /keyboard=\{!forced\}/);
  assert.match(passwordModal, /changeCurrentPassword/);
});

test('首次登录改密弹窗允许退出当前登录后切换账号', () => {
  assert.match(passwordModal, /onForcedExit\?: \(\) => void/);
  assert.match(passwordModal, /cancelText=\{forced \? '退出登录' : '取消'\}/);
  assert.match(passwordModal, /if \(forced\) \{[\s\S]*onForcedExit\?\.\(\)/);
  assert.match(loginPage, /logoutAccessSession\(accessSessionId\)/);
  assert.match(loginPage, /clearAuth\(\)/);
  assert.match(loginPage, /<PasswordChangeModal[\s\S]*onForcedExit=/);
});

test('退出登录必须在清理本地鉴权前完成服务端会话注销', () => {
  assertLogoutCompletesBeforeAuthClear(loginPage, 1);
  assertLogoutCompletesBeforeAuthClear(adminLayout, 2);
  assert.doesNotMatch(loginPage, /const logoutPromise = logoutAccessSession/);
  assert.doesNotMatch(adminLayout, /const logoutPromise = logoutAccessSession/);
});
