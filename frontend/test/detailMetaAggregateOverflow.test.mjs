import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const detailMetaSource = fs.readFileSync(new URL('../src/components/admin/DetailMetaList/index.tsx', import.meta.url), 'utf8');
const detailMetaStyles = fs.readFileSync(new URL('../src/components/admin/DetailMetaList/index.css', import.meta.url), 'utf8');
const roleDetailSource = fs.readFileSync(new URL('../src/modules/role/pages/RoleDetailPage.tsx', import.meta.url), 'utf8');
const userDetailSource = fs.readFileSync(new URL('../src/modules/user/pages/UserDetailPage.tsx', import.meta.url), 'utf8');
const workOrderDetailSource = fs.readFileSync(new URL('../src/modules/work-order/pages/WorkOrderDetailPage.tsx', import.meta.url), 'utf8');
const detailDemoSource = fs.readFileSync(new URL('../src/modules/design-system/pages/demos/DetailTemplateDemo.tsx', import.meta.url), 'utf8');
const developmentRules = fs.readFileSync(new URL('../../docs/ai-development-rules.md', import.meta.url), 'utf8');

test('详情普通字段默认限制两行，长文本和富文本保持完整展示', () => {
  assert.match(detailMetaSource, /aggregate\?: boolean/);
  assert.match(detailMetaSource, /longText\?: boolean/);
  assert.match(detailMetaSource, /typeof item\.value === 'string'/);
  assert.match(detailMetaSource, /typeof item\.value === 'number'/);
  assert.match(detailMetaSource, /!item\.longText && \(item\.aggregate \|\| isTextValue\)/);
  assert.match(detailMetaSource, /<Tooltip title=\{item\.value\}>/);
  assert.match(detailMetaSource, /is-clamped/);
  assert.match(detailMetaStyles, /\.admin-detail-meta-list__item dd\.is-clamped[\s\S]*-webkit-line-clamp:\s*2/);
  assert.match(detailMetaStyles, /\.admin-detail-meta-list__item dd\.is-clamped[\s\S]*white-space:\s*normal/);
  assert.match(roleDetailSource, /label: '权限范围',[^\n]*aggregate: true/);
  assert.match(roleDetailSource, /label: '角色描述',[^\n]*longText: true/);
  assert.match(userDetailSource, /label: '所属角色',[^\n]*aggregate: true/);
  assert.match(workOrderDetailSource, /label: '处置结果',[^\n]*longText: true/);
  assert.match(detailDemoSource, /label: '所属角色',[^\n]*aggregate: true/);
  assert.match(developmentRules, /普通文本字段[\s\S]*最多显示两行[\s\S]*悬浮展示完整内容/);
  assert.match(developmentRules, /描述、备注、进展、风险[\s\S]*longText/);
});
