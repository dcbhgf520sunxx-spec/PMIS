import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('工单详情复用统一状态规则与载荷构建', () => {
  const detail = read('../src/modules/work-order/pages/WorkOrderDetailPage.tsx');
  assert.match(detail, /from '\.\/workOrderList\.constants'/);
  assert.doesNotMatch(detail, /const statusTransitions/);
  assert.doesNotMatch(detail, /function buildStatusPayload/);
});

test('角色表单和详情复用菜单树工具', () => {
  const form = read('../src/modules/role/pages/RoleFormPage.tsx');
  const detail = read('../src/modules/role/pages/RoleDetailPage.tsx');
  assert.match(form, /from '\.\.\/roleMenuTree'/);
  assert.match(detail, /from '\.\.\/roleMenuTree'/);
});

test('状态回退语义由当前和目标状态共同决定', () => {
  const action = read('../src/modules/work-order/components/WorkOrderStatusChangeAction/index.tsx');
  assert.match(action, /getTransitionTone/);
  assert.match(action, /target < current/);
});

test('逾期标签不再硬编码三天', () => {
  const helpers = read('../src/modules/work-order/helpers.tsx');
  assert.doesNotMatch(helpers, /isOverdue \? 3 : 0/);
});

test('已逾期但缺少到期时间时展示逾期而不是未逾期', () => {
  const helpers = read('../src/modules/work-order/helpers.tsx');
  const tag = read('../src/components/admin/OverdueTag/index.tsx');
  assert.match(helpers, /if \(!expectedResolveDate\) return <OverdueTag overdue/);
  assert.match(tag, /overdue\?: boolean/);
  assert.match(tag, /if \(overdue\)/);
  assert.match(tag, />逾期<\/Tag>/);
});

test('dayjs 是前端直接依赖且表单不保留 startTime', () => {
  const pkg = JSON.parse(read('../package.json'));
  const form = read('../src/modules/work-order/pages/WorkOrderFormPage.tsx');
  assert.ok(pkg.dependencies.dayjs);
  assert.doesNotMatch(form, /startTime/);
});

test('统一门禁自动发现前端测试文件', () => {
  const gate = read('../../scripts/verify-change.mjs');
  assert.match(gate, /readdirSync/);
  assert.doesNotMatch(gate, /'test\/aiSemanticRules\.test\.mjs'/);
});

test('工单列表通过统一服务端列表能力提供加载、错误和重试状态', () => {
  const page = read('../src/modules/work-order/pages/WorkOrderListPage.tsx');
  const hook = read('../src/modules/work-order/pages/useWorkOrderListData.ts');
  assert.match(page, /error=\{error\}/);
  assert.match(page, /onRetry=\{reload\}/);
  assert.match(page, /loading:\s*listData\.loading/);
  assert.doesNotMatch(page, /\bworkOrders,|\bserverTotal,/);
  assert.match(hook, /useTemplateServerListData/);
  assert.match(hook, /error:\s*listData\.error/);
  assert.match(hook, /reload:\s*listData\.reload/);
  assert.doesNotMatch(hook, /setError|setWorkOrders|setServerTotal/);
});
