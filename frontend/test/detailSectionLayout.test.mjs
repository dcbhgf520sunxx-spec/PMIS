import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import { createServer } from 'vite';

test('详情分组可选择填满高度并将内容放入独立滚动区，普通分组保持自然布局', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { TemplateDetailSection } = await server.ssrLoadModule('/src/components/admin/TemplateDetailPage/index.tsx');
    const content = createElement('div', null, '权限内容');
    const fill = renderToStaticMarkup(createElement(TemplateDetailSection, { title: '权限', fill: true }, content));
    assert.match(fill, /class="admin-template-detail-page__panel is-fill"/);
    assert.match(fill, /class="admin-template-detail-page__panel-content"><div>权限内容<\/div>/);
    const natural = renderToStaticMarkup(createElement(TemplateDetailSection, { title: '基本信息' }, content));
    assert.doesNotMatch(natural, /is-fill|panel-content/);
    assert.match(natural, /权限内容/);
  } finally {
    await server.close();
  }
});
