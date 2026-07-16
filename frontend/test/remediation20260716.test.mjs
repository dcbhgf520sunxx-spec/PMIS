import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('富文本清洗会继续处理未知父标签提升出来的子节点', () => {
  const richText = read('../src/utils/richText.ts');
  assert.match(richText, /sanitizeElement|sanitizeNode/);
  assert.doesNotMatch(richText, /replaceWith\([^\n]+\);\s*return;/);
});

test('工单状态严格按待处理到处理中到已解决到已关闭流转', () => {
  const rules = read('../src/modules/work-order/pages/workOrderList.constants.ts');
  assert.match(rules, /0:\s*\[1\]/);
  assert.match(rules, /1:\s*\[2\]/);
  assert.match(rules, /2:\s*\[3\]/);
  assert.match(rules, /3:\s*\[\]/);
});

test('用户角色聚合列接入真实服务端排序', () => {
  const page = read('../src/modules/user/pages/UserListPage.tsx');
  const api = read('../src/api/userApi.ts');
  const roleColumn = page.match(/title:\s*'角色'[\s\S]*?\n\s*},/)?.[0] || '';
  assert.match(roleColumn, /sorter:\s*true/);
  assert.match(roleColumn, /sortOrder:/);
  assert.match(api, /roleName:\s*'roles'/);
});

test('接口返回 401 时立即清理过期登录态', () => {
  const requestClient = read('../src/api/requestClient.ts');
  const workOrderListData = read('../src/modules/work-order/pages/useWorkOrderListData.ts');
  assert.match(requestClient, /function clearExpiredSession/);
  assert.match(requestClient, /status !== 401/);
  assert.match(requestClient, /auth\.clearAuth\(\)/);
  assert.match(requestClient, /clearExpiredSession\(Number\(payload\?\.code \|\| error\?\.response\?\.status\)\)/);
  assert.match(workOrderListData, /getUserOptions\(\)\.then\(setUserOptions\)\.catch/);
});

test('关键登录流程接入独立数据库的浏览器自动验收', () => {
  const packageJson = JSON.parse(read('../package.json'));
  const playwrightConfig = read('../playwright.config.ts');
  const coreFlow = read('../e2e/core-flow.spec.ts');
  const workflow = read('../../.github/workflows/verify.yml');

  assert.equal(packageJson.scripts['test:e2e'], 'playwright test');
  assert.match(playwrightConfig, /INTEGRATION_DB_ISOLATED/);
  assert.match(playwrightConfig, /outputDir:\s*['"]\/tmp\/project-template-playwright-results['"]/);
  assert.match(coreFlow, /首次登录请修改密码/);
  assert.match(coreFlow, /确认修改并进入系统/);
  assert.match(coreFlow, /运维工单/);
  assert.match(coreFlow, /reset-password/);
  assert.match(workflow, /db:migrate -- --baseline/);
  assert.match(workflow, /npm run test:e2e/);
});

test('远程门禁不为同一修复提交重复运行并取消过期检查', () => {
  const workflow = read('../../.github/workflows/verify.yml');

  assert.match(workflow, /push:\s*\n\s+branches:\s*\[master\]/);
  assert.match(workflow, /pull_request:\s*\n\s+branches:\s*\[master\]/);
  assert.match(workflow, /concurrency:\s*\n\s+group:\s*verify-/);
  assert.match(workflow, /cancel-in-progress:\s*true/);
});

test('AI 交付流程说明远程门禁的唯一触发时机', () => {
  const flow = read('../../docs/ai-delivery-flow.md');

  assert.match(flow, /修复分支只在合并请求创建或更新时运行远程门禁/);
  assert.match(flow, /合入 `master` 后再运行一次/);
});

test('生产构建产物有可重复执行的体积预算', () => {
  const scriptUrl = new URL('../scripts/check-build-budget.mjs', import.meta.url);
  assert.equal(existsSync(scriptUrl), true);

  const packageJson = JSON.parse(read('../package.json'));
  const script = read('../scripts/check-build-budget.mjs');
  const verify = read('../../scripts/verify-change.mjs');
  assert.equal(packageJson.scripts['audit:build-budget'], 'node scripts/check-build-budget.mjs');
  assert.match(script, /800 \* 1024/);
  assert.match(script, /1\.5 \* 1024 \* 1024/);
  assert.match(script, /7 \* 1024 \* 1024/);
  assert.match(verify, /'run', 'audit:build-budget'/);
});

test('前后端依赖只自动跟进同主版本更新', () => {
  const configUrl = new URL('../../.github/dependabot.yml', import.meta.url);
  assert.equal(existsSync(configUrl), true);

  const config = read('../../.github/dependabot.yml');
  assert.match(config, /directory:\s*"\/frontend"/);
  assert.match(config, /directory:\s*"\/backend"/);
  assert.match(config, /interval:\s*"monthly"/);
  assert.match(config, /update-types:\s*\["minor", "patch"\]/);
  assert.match(config, /version-update:semver-major/);
});
