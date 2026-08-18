import assert from 'node:assert/strict';
import test from 'node:test';

import * as roleMenuTree from '../src/modules/role/roleMenuTree.ts';

const tree = [
  {
    key: 1,
    title: '组件工作台',
    children: [
      { key: 2, title: '总览' },
      {
        key: 3,
        title: '输入',
        children: [{ key: 4, title: '附件上传' }],
      },
    ],
  },
];

test('子权限已选但父权限未授权时只返回父级半选状态', () => {
  assert.equal(typeof roleMenuTree.collectHalfCheckedKeys, 'function');
  assert.deepEqual(roleMenuTree.collectHalfCheckedKeys(tree, [2]), [1]);
});

test('深层子权限已选时所有未授权祖先都显示半选', () => {
  assert.deepEqual(roleMenuTree.collectHalfCheckedKeys(tree, [4]), [3, 1]);
});

test('父权限已独立授权时不将父权限标记为半选', () => {
  assert.deepEqual(roleMenuTree.collectHalfCheckedKeys(tree, [1, 2]), []);
});
