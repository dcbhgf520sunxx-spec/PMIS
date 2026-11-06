import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import { createServer } from 'vite';

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
