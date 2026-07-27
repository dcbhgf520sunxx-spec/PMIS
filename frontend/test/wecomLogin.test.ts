import assert from 'node:assert/strict';
import test from 'node:test';

import { parseWecomLoginSearch } from '../src/modules/auth/wecomLogin.ts';

test('企微回调票据从登录页地址中读取且不接受空票据', () => {
  assert.deepEqual(
    parseWecomLoginSearch('?wecom_ticket=ticket-a'),
    { ticket: 'ticket-a' }
  );
  assert.deepEqual(
    parseWecomLoginSearch('?wecom_ticket='),
    {}
  );
});

test('企微账号不存在和停用错误转换为明确的用户提示', () => {
  assert.deepEqual(
    parseWecomLoginSearch('?wecom_error=account_not_found'),
    { errorMessage: '账号尚未开通，请联系管理员' }
  );
  assert.deepEqual(
    parseWecomLoginSearch('?wecom_error=account_disabled'),
    { errorMessage: '账号已停用，请联系管理员' }
  );
});

test('非法 state 和未知错误不向页面泄露企微内部错误', () => {
  assert.deepEqual(
    parseWecomLoginSearch('?wecom_error=invalid_state'),
    { errorMessage: '企微登录验证已失效，请从企微工作台重新进入' }
  );
  assert.deepEqual(
    parseWecomLoginSearch('?wecom_error=unexpected-secret-detail'),
    { errorMessage: '企微登录失败，请从企微工作台重新进入' }
  );
});

test('普通密码登录地址不触发企微登录流程', () => {
  assert.deepEqual(parseWecomLoginSearch(''), {});
  assert.deepEqual(parseWecomLoginSearch('?from=logout'), {});
});
