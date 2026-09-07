import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createServer } from 'vite';

test('共享手册匿名直达独立 HTML，且目录锚点均可定位', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, appType: 'custom' });
  try {
    await server.listen();
    const port = server.httpServer.address().port;
    const response = await fetch(`http://127.0.0.1:${port}/docs/sidm-open-api.html`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    const html = await response.text();
    assert.match(html, /<title>SIDM 接口手册<\/title>/);
    const anchors = [...html.matchAll(/href="#([^"]+)"/g)];
    assert.ok(anchors.length >= 6);
    for (const [, id] of anchors) assert.ok(html.includes(`id="${id}"`), `失效目录：${id}`);
    assert.doesNotMatch(html, /<script|<iframe|sidm_open_[a-zA-Z0-9]+/);
  } finally {
    await server.close();
  }
});

test('接口手册明确列出查询返回的创建和更新信息', () => {
  const html = readFileSync('public/docs/sidm-open-api.html', 'utf8');
  const markdown = readFileSync('../docs/SIDM开放接口接入.md', 'utf8');
  for (const [field, label] of [
    ['creator', '创建人'],
    ['updater', '更新人'],
    ['createdAt', '创建时间'],
    ['updatedAt', '更新时间']
  ]) {
    assert.match(html, new RegExp(`<td>${field}</td><td>${label}</td>`));
    assert.match(markdown, new RegExp(`\\| ${field} \\| ${label} \\|`));
  }
  assert.match(html, /"creator": \{"employeeNo":"EMP001","name":"示例人员"\}/);
});
