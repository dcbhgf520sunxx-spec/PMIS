import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const detailMetaSource = fs.readFileSync(new URL('../src/components/admin/DetailMetaList/index.tsx', import.meta.url), 'utf8');
const detailMetaStyles = fs.readFileSync(new URL('../src/components/admin/DetailMetaList/index.css', import.meta.url), 'utf8');
const roleDetailSource = fs.readFileSync(new URL('../src/modules/role/pages/RoleDetailPage.tsx', import.meta.url), 'utf8');
const userDetailSource = fs.readFileSync(new URL('../src/modules/user/pages/UserDetailPage.tsx', import.meta.url), 'utf8');
const detailDemoSource = fs.readFileSync(new URL('../src/modules/design-system/pages/demos/DetailTemplateDemo.tsx', import.meta.url), 'utf8');
const developmentRules = fs.readFileSync(new URL('../../docs/ai-development-rules.md', import.meta.url), 'utf8');

test('详情聚合字段统一限制两行并悬浮展示完整内容', () => {
  assert.match(detailMetaSource, /aggregate\?: boolean/);
  assert.match(detailMetaSource, /<Tooltip title=\{item\.value\}>/);
  assert.match(detailMetaSource, /is-aggregate/);
  assert.match(detailMetaStyles, /\.admin-detail-meta-list__item dd\.is-aggregate[\s\S]*-webkit-line-clamp:\s*2/);
  assert.match(detailMetaStyles, /\.admin-detail-meta-list__item dd\.is-aggregate[\s\S]*white-space:\s*normal/);
  assert.match(roleDetailSource, /label: '权限范围',[^\n]*aggregate: true/);
  assert.match(userDetailSource, /label: '所属角色',[^\n]*aggregate: true/);
  assert.match(detailDemoSource, /label: '所属角色',[^\n]*aggregate: true/);
  assert.match(developmentRules, /聚合字段[\s\S]*最多显示两行[\s\S]*悬浮展示完整内容/);
});
