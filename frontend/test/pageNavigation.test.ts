import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendReturnTo,
  currentRelativePath,
  resolveReturnTo,
  sanitizeInternalReturnTo
} from '../src/components/admin/PageNavigation/pageNavigation.ts';

test('页面跳转携带包含查询排序的完整来源地址', () => {
  const current = currentRelativePath({ pathname: '/tasks', search: '?view=mine&page=2', hash: '' });
  assert.equal(appendReturnTo('/tasks/25', current), '/tasks/25?returnTo=%2Ftasks%3Fview%3Dmine%26page%3D2');
});

test('详情进入编辑时保留嵌套的列表返回链路', () => {
  const detail = '/tasks/25?returnTo=%2Ftasks%3Fpage%3D2';
  const edit = appendReturnTo('/tasks/25/edit', detail);
  assert.equal(resolveReturnTo(new URL(`http://local${edit}`).search, '/tasks', '/tasks'), detail);
});

test('返回地址仅允许当前模块的站内相对路径', () => {
  assert.equal(sanitizeInternalReturnTo('/tasks/25?page=2', '/tasks'), '/tasks/25?page=2');
  assert.equal(sanitizeInternalReturnTo('https://evil.example/tasks', '/tasks'), null);
  assert.equal(sanitizeInternalReturnTo('//evil.example/tasks', '/tasks'), null);
  assert.equal(sanitizeInternalReturnTo('/users', '/tasks'), null);
  assert.equal(sanitizeInternalReturnTo('/tasks-evil', '/tasks'), null);
});

test('非法或缺失返回地址使用模块默认列表', () => {
  assert.equal(resolveReturnTo('?returnTo=https%3A%2F%2Fevil.example', '/tasks', '/tasks'), '/tasks');
  assert.equal(resolveReturnTo('', '/tasks', '/tasks'), '/tasks');
});
