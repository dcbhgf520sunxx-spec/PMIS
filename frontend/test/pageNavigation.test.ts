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

test('业务详情允许返回指定的数字孪生来源并保留产品与分页', () => {
  const source = '/digital-twin?product=78&kind=orders&node=order&page=2&pageSize=6&scroll=710';
  const search = new URL(`http://local${appendReturnTo('/work-orders/95', source)}`).search;
  for (const module of ['/work-orders', '/tasks', '/bugs', '/projects', '/requirements', '/products']) {
    assert.equal(resolveReturnTo(search, module, module, ['/digital-twin']), source);
  }
});

test('跨模块来源白名单只匹配完整路径且继续拒绝外部地址', () => {
  for (const source of ['/digital-twin-evil', '/digital-twin/admin', '//evil.example/digital-twin', 'https://evil.example/digital-twin', '/users']) {
    assert.equal(resolveReturnTo(`?returnTo=${encodeURIComponent(source)}`, '/tasks', '/tasks', ['/digital-twin']), '/tasks');
  }
  assert.equal(resolveReturnTo('?returnTo=%2Fdigital-twin', '/tasks', '/tasks'), '/tasks');
});

test('从孪生进入编辑再返回详情仍保留最初来源', () => {
  const detail = '/tasks/25?returnTo=%2Fdigital-twin%3Fproduct%3D78%26kind%3Dtasks';
  const edit = appendReturnTo('/tasks/25/edit', detail);
  const returned = resolveReturnTo(new URL(`http://local${edit}`).search, '/tasks', '/tasks', ['/digital-twin']);
  assert.equal(returned, detail);
  assert.equal(resolveReturnTo(new URL(`http://local${returned}`).search, '/tasks', '/tasks', ['/digital-twin']), '/digital-twin?product=78&kind=tasks');
});
