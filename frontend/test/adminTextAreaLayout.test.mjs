import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const css = fs.readFileSync(new URL('../src/components/admin/AdminInput/index.css', import.meta.url), 'utf8');

test('带字数统计的长文本域不继承单行输入框固定高度', () => {
  assert.match(css, /\.admin-textarea\.ant-input-affix-wrapper\s*\{[^}]*height:\s*auto;/s);
  assert.match(css, /\.admin-textarea\.ant-input-affix-wrapper\s*\{[^}]*align-items:\s*flex-start;/s);
});
