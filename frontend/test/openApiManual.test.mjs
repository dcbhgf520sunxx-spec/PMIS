import assert from 'node:assert/strict';
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
