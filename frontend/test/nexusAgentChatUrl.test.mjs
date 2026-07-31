import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getNexusChatUrl
} from '../src/modules/assistant/nexusAgentConfig.ts';

test('PMIS 自有桌宠使用 HTTPS 地址和临时 ticket 打开 Nexus 对话页', () => {
  assert.equal(
    getNexusChatUrl('sso_tk_once'),
    'https://ai.znjs.com:3100/embed/bbadcfd5-424f-369d-96e2-0c0a6a65073a?ticket=sso_tk_once'
  );
});
