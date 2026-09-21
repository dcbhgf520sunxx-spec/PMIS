import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

test('操作列组件统一接管更多折叠机制', () => {
  const source = read('src/components/admin/OperationColumnActions/index.tsx');

  assert.match(source, /collapseThreshold = 4/, '操作数达到 4 个及以上才出现更多');
  assert.match(source, /visibleCountWhenCollapsed = 2/, '出现更多时只直出前 2 个动作');
  assert.match(source, /actions\.length >= collapseThreshold/, '达到折叠阈值后应自动出现更多');
  assert.match(source, /actions\.slice\(0, visibleCountWhenCollapsed\)/, '折叠时只展示前 2 个动作');
  assert.match(source, /actions\.slice\(visibleCountWhenCollapsed\)/, '第 3 个及之后进入更多');
  assert.match(source, /overflowActions/, '超出动作应统一进入更多区域');
  assert.match(source, /更多/, '更多入口文案应统一');
});

test('操作列更多浮层使用轻量下拉样式', () => {
  const source = read('src/components/admin/OperationColumnActions/index.tsx');
  const css = read('src/components/admin/OperationColumnActions/index.css');

  assert.match(source, /overlayClassName="admin-operation-column-actions__popover"/, '更多浮层应挂统一样式类');
  assert.match(css, /\.admin-operation-column-actions__popover \.ant-popover-inner/, '应覆盖 Popover 内层为下拉菜单样式');
  assert.match(css, /padding: 4px;/, '浮层内边距应接近 Dropdown 菜单');
  assert.match(css, /box-shadow: 0 6px 16px/, '浮层阴影应接近 Dropdown，而不是普通弹窗');
  assert.match(css, /\.admin-operation-column-actions__more \.ant-btn-link\.admin-text-action/, '更多菜单项应覆盖全局文字操作按钮样式');
  assert.match(css, /\.admin-operation-column-actions__more \.ant-btn-link\.admin-text-action\.is-danger/, '更多里的危险动作应保留红色语义');
});

test('运维工单操作列只传动作顺序，不再手写更多规则', () => {
  const source = read('src/modules/work-order/pages/WorkOrderListColumns.tsx');

  assert.match(source, /<OperationColumnActions>/);
  assert.match(source, /<DeleteConfirmAction/);
  assert.doesNotMatch(source, /AdminActionDropdown/, '业务页不应自己决定更多下拉');
});

test('隐藏、无权限和分组操作先过滤，后续动作补位且不重复', async () => {
  const { createElement: h, Fragment } = await import('react');
  const { visibleOperationActions } = await import('../src/components/admin/OperationColumnActions/visibleActions.ts');
  const action = (name, props = {}) => h('button', { key: name, ...props }, name);
  const children = [action('编辑'), null, false, action('状态', { hidden: true }),
    action('授权动作', { permission: 'edit' }),
    h(Fragment, { key: 'group' }, action('跟进'), h(Fragment, null, action('复制'))), action('删除')];
  const names = (permissions) => visibleOperationActions(children, permissions).map(item => item.props.children);
  assert.deepEqual(names([]), ['编辑', '跟进', '复制', '删除']);
  assert.deepEqual(names(['edit']), ['编辑', '授权动作', '跟进', '复制', '删除']);
  const items = visibleOperationActions(children, []);
  assert.equal(new Set(items.map(item => item.key)).size, 4);
  assert.equal(visibleOperationActions([false, null, action('隐藏', { hidden: true })], []).length, 0);
});

test('无权限但保留禁用入口仍占位，显式隐藏优先', async () => {
  const { createElement: h } = await import('react');
  const { visibleOperationActions } = await import('../src/components/admin/OperationColumnActions/visibleActions.ts');
  const disabled = h('button', { permission: 'edit', unauthorizedMode: 'disabled' }, '编辑');
  assert.equal(visibleOperationActions([disabled], []).length, 1);
  assert.equal(visibleOperationActions([h('button', { ...disabled.props, hidden: true })], []).length, 0);
});
