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

test('首次改密允许关闭并退出登录，保存时禁用关闭', () => {
  assert.match(passwordModal, /closable=\{!saving\}/);
  assert.match(passwordModal, /maskClosable=\{!forced && !saving\}/);
  assert.match(passwordModal, /keyboard=\{!saving\}/);
  assert.match(passwordModal, /changeCurrentPassword/);
});

test('首次登录改密弹窗允许退出当前登录后切换账号', () => {
  assert.match(passwordModal, /onCancel\?: \(\) => void \| Promise<void>/);
  assert.match(passwordModal, /cancelText=\{forced \? '退出登录' : '取消'\}/);
  assert.match(passwordModal, /await onCancel\?\.\(\)/);
  assert.match(loginPage, /logoutAccessSession\(accessSessionId, \{ token \}\)/);
  assert.match(loginPage, /clearAuth\(\)/);
  assert.match(loginPage, /<PasswordChangeModal[\s\S]*onCancel=\{handleForcedPasswordExit\}/);
});

test('首次改密退出立即清除本地登录，其他退出仍等待服务端注销', () => {
  assert.match(loginPage, /void logoutAccessSession\(accessSessionId, \{ token \}\)/);
  assert.match(loginPage, /退出请求未完成，已清除本地登录状态/);
  assertLogoutCompletesBeforeAuthClear(adminLayout, 2);
  assert.doesNotMatch(loginPage, /const logoutPromise = logoutAccessSession/);
  assert.doesNotMatch(adminLayout, /const logoutPromise = logoutAccessSession/);
});
