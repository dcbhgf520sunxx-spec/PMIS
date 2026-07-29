import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url).pathname;

function read(path) {
  const file = `${root}/${path}`;
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

test('智能助手使用无蒙层可调宽侧栏并支持全屏', () => {
  const source = read('src/modules/assistant/components/NexusAgentAssistant.tsx');
  const styles = read('src/modules/assistant/components/NexusAgentAssistant.css');

  assert.doesNotMatch(source, /AdminDrawer/);
  assert.match(source, /nexus-agent-assistant-panel/);
  assert.match(source, /role="separator"/);
  assert.match(source, /onPointerDown/);
  assert.match(source, /onPointerMove/);
  assert.match(source, /onKeyDown/);
  assert.match(source, /localStorage/);
  assert.match(source, /FullscreenOutlined/);
  assert.match(source, /FullscreenExitOutlined/);
  assert.match(styles, /position:\s*fixed/);
  assert.match(styles, /width:\s*var\(--nexus-agent-assistant-width\)/);
  assert.match(styles, /@media \(max-width:\s*760px\)/);
  assert.doesNotMatch(styles, /ant-drawer-mask/);
});

test('关闭智能助手只隐藏面板并保留当前对话', () => {
  const source = read('src/modules/assistant/components/NexusAgentAssistant.tsx');

  const closeHandler = source.match(/const handleClose = \(\) => \{([\s\S]*?)\n  \};/)?.[1] || '';
  assert.match(closeHandler, /setOpen\(false\)/);
  assert.doesNotMatch(closeHandler, /setChatUrl\(null\)/);
  assert.doesNotMatch(source, /destroyOnHidden/);
  assert.match(source, /chatUrl \? \(\s*<iframe/);
});

test('PMIS 全局布局挂载 Nexus 智能助手并通过登录票据打开对话', () => {
  const layout = read('src/layouts/AdminLayout/index.tsx');
  const authApi = read('src/api/authApi.ts');
  const config = read('src/modules/assistant/nexusAgentConfig.ts');

  assert.match(layout, /assistantStorageKey/);
  assert.match(layout, /<NexusAgentAssistant storageKey=\{assistantStorageKey\} \/>/);
  assert.match(authApi, /getNexusSsoTicket/);
  assert.match(config, /getNexusChatUrl/);
  assert.match(config, /searchParams\.set\('ticket', ticket\)/);
});
