import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import { createServer } from 'vite';

test('只读授权树保留勾选和半选结果，禁止修改且不改变输入节点', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { AdminTree } = await server.ssrLoadModule('/src/components/admin/AdminPrimitives/index.tsx');
    const treeData = [{ key: 'root', title: '权限', children: [
      { key: 'selected', title: '已授权' },
      { key: 'unselected', title: '未授权' },
      { key: 'disabled', title: '已禁用', disabled: true }
    ] }];
    const original = JSON.stringify(treeData);
    const props = { treeData, checkable: true, defaultExpandAll: true, virtual: false, checkedKeys: ['selected'] };
    const readOnly = renderToStaticMarkup(createElement(AdminTree, { ...props, readOnly: true }));
    assert.doesNotMatch(readOnly, /<input[^>]*disabled/);
    assert.equal((readOnly.match(/ant-tree-checkbox-disabled/g) || []).length, 1);
    assert.equal((readOnly.match(/ant-tree-checkbox-checked/g) || []).length, 1);
    assert.equal((readOnly.match(/ant-tree-checkbox-indeterminate/g) || []).length, 1);
    assert.match(readOnly, /aria-readonly="true"/);
    assert.equal(JSON.stringify(treeData), original);

    const editable = renderToStaticMarkup(createElement(AdminTree, props));
    assert.equal((editable.match(/ant-tree-checkbox-disabled/g) || []).length, 1);
    assert.equal((editable.match(/ant-tree-checkbox-indeterminate/g) || []).length, 1);
  } finally {
    await server.close();
  }
});

test('树形展示统一方框加减，展开状态与连接线设置不改变开关样式', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { AdminTree } = await server.ssrLoadModule('/src/components/admin/AdminPrimitives/index.tsx');
    for (const showLine of [false, true]) {
      for (const expanded of [false, true]) {
        const markup = renderToStaticMarkup(createElement(AdminTree, {
          showLine, virtual: false, expandedKeys: expanded ? ['root'] : [],
          treeData: [{ key: 'root', title: '组织', children: [{ key: 'child', title: '部门' }] }]
        }));
        assert.ok(markup.includes(expanded ? 'minus-square' : 'plus-square'));
        assert.doesNotMatch(markup, /caret-down|caret-right/);
        assert.match(markup, /admin-tree/);
      }
    }
  } finally {
    await server.close();
  }
});
