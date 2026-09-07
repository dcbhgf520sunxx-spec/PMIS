import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('接入系统列表只展示系统名称，不展示内部系统编码', () => {
  const source = fs.readFileSync(path.join(root, 'src/modules/integration/pages/OpenClientListPage.tsx'), 'utf8');
  assert.doesNotMatch(source, /title:'系统编码'/);
  assert.match(source, /title:'系统名称',dataIndex:'name'/);
  assert.match(source, /key:'keyword',label:'系统名称'/);
  assert.doesNotMatch(source, /label:'系统名称\/编码'/);
});
