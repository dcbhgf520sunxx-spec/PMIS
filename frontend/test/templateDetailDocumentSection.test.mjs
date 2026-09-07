import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('详情模板将单据信息固定渲染为单列', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

  try {
    const { TemplateDetailPage } = await server.ssrLoadModule(
      '/src/components/admin/TemplateDetailPage/index.tsx'
    );
    const markup = renderToStaticMarkup(
      React.createElement(
        TemplateDetailPage,
        {
          title: '测试详情',
          documentSection: {
            items: [
              { label: '创建人', value: '管理员' },
              { label: '创建时间', value: '2026-09-07 10:00' }
            ]
          }
        },
        React.createElement('div', null, '详情内容')
      )
    );

    assert.match(markup, /admin-detail-meta-list is-columns-1/);
  } finally {
    await server.close();
  }
});
