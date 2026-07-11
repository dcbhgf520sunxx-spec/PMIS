import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const scriptPath = new URL('../scripts/audit-component-usage.mjs', import.meta.url).pathname;

test('组件审计阻断绕开 TemplateListPage 的业务列表', () => {
  const modulesDir = mkdtempSync(join(tmpdir(), 'component-audit-'));
  const pagePath = join(modulesDir, 'ArchivePage.tsx');
  writeFileSync(pagePath, 'export function ArchivePage() { return <SearchTable />; }');

  try {
    const result = spawnSync(process.execPath, [scriptPath, '--strict', '--modules-dir', modulesDir], {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /TemplateListPage/);
  } finally {
    rmSync(modulesDir, { recursive: true, force: true });
  }
});

test('组件审计阻断在 AdminDrawer 中直接拼 TemplateListPage', () => {
  const modulesDir = mkdtempSync(join(tmpdir(), 'component-audit-'));
  const pagePath = join(modulesDir, 'RelatedRecordPage.tsx');
  writeFileSync(pagePath, 'export function RelatedRecordPage() { return <AdminDrawer><TemplateListPage /></AdminDrawer>; }');

  try {
    const result = spawnSync(process.execPath, [scriptPath, '--strict', '--modules-dir', modulesDir], {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /TemplateDrawerTable/);
  } finally {
    rmSync(modulesDir, { recursive: true, force: true });
  }
});

test('组件审计阻断业务页直接使用 antd Tree', () => {
  const modulesDir = mkdtempSync(join(tmpdir(), 'component-audit-'));
  const pagePath = join(modulesDir, 'RoleFormPage.tsx');
  writeFileSync(pagePath, 'export function RoleFormPage() { return <Tree checkable />; }');

  try {
    const result = spawnSync(process.execPath, [scriptPath, '--strict', '--modules-dir', modulesDir], {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /AdminTree/);
  } finally {
    rmSync(modulesDir, { recursive: true, force: true });
  }
});

test('组件审计阻断业务页直接使用 ProForm.Item', () => {
  const modulesDir = mkdtempSync(join(tmpdir(), 'component-audit-'));
  const pagePath = join(modulesDir, 'WorkOrderFormPage.tsx');
  writeFileSync(pagePath, 'export function WorkOrderFormPage() { return <ProForm.Item name="problemDesc" />; }');

  try {
    const result = spawnSync(process.execPath, [scriptPath, '--strict', '--modules-dir', modulesDir], {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /AdminProForm/);
  } finally {
    rmSync(modulesDir, { recursive: true, force: true });
  }
});

test('组件审计阻断业务页直接使用 antd Button', () => {
  const modulesDir = mkdtempSync(join(tmpdir(), 'component-audit-'));
  const pagePath = join(modulesDir, 'UserDetailPage.tsx');
  writeFileSync(pagePath, 'export function UserDetailPage() { return <Button onClick={() => {}}>返回</Button>; }');

  try {
    const result = spawnSync(process.execPath, [scriptPath, '--strict', '--modules-dir', modulesDir], {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /AdminButton/);
  } finally {
    rmSync(modulesDir, { recursive: true, force: true });
  }
});

test('组件审计阻断业务页直接使用 Typography.Text', () => {
  const modulesDir = mkdtempSync(join(tmpdir(), 'component-audit-'));
  const pagePath = join(modulesDir, 'WorkOrderTemplatePage.tsx');
  writeFileSync(pagePath, 'export function WorkOrderTemplatePage() { return <Typography.Text type="warning">状态不一致</Typography.Text>; }');

  try {
    const result = spawnSync(process.execPath, [scriptPath, '--strict', '--modules-dir', modulesDir], {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /AdminText/);
  } finally {
    rmSync(modulesDir, { recursive: true, force: true });
  }
});

test('组件审计阻断 FormPage 绕开 TemplateFormPage', () => {
  const modulesDir = mkdtempSync(join(tmpdir(), 'component-audit-'));
  writeFileSync(join(modulesDir, 'CustomerFormPage.tsx'), 'export function CustomerFormPage() { return <PageShell><AdminInput /></PageShell>; }');

  try {
    const result = spawnSync(process.execPath, [scriptPath, '--strict', '--modules-dir', modulesDir], {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /TemplateFormPage/);
  } finally {
    rmSync(modulesDir, { recursive: true, force: true });
  }
});

test('组件审计阻断 DetailPage 绕开 TemplateDetailPage', () => {
  const modulesDir = mkdtempSync(join(tmpdir(), 'component-audit-'));
  writeFileSync(join(modulesDir, 'CustomerDetailPage.tsx'), 'export function CustomerDetailPage() { return <PageShell><AdminCard /></PageShell>; }');

  try {
    const result = spawnSync(process.execPath, [scriptPath, '--strict', '--modules-dir', modulesDir], {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /TemplateDetailPage/);
  } finally {
    rmSync(modulesDir, { recursive: true, force: true });
  }
});

function runStrictAudit(source: string, fileName = 'CustomerDetailPage.tsx') {
  const modulesDir = mkdtempSync(join(tmpdir(), 'component-audit-'));
  writeFileSync(join(modulesDir, fileName), source);
  const result = spawnSync(process.execPath, [scriptPath, '--strict', '--modules-dir', modulesDir], {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  rmSync(modulesDir, { recursive: true, force: true });
  return result;
}

test('组件审计阻断操作列中的普通按钮形态', () => {
  const result = runStrictAudit(
    'export function CustomerListPage() { return <OperationColumnActions><AdminButton>状态变更</AdminButton></OperationColumnActions>; }',
    'CustomerListPage.tsx'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /操作列.*文字操作/);
});

test('组件审计阻断使用通用危险确认实现删除', () => {
  const result = runStrictAudit(
    'export function CustomerListPage() { return <OperationColumnActions><ConfirmAction variant="text" danger title="确认删除">删除</ConfirmAction></OperationColumnActions>; }',
    'CustomerListPage.tsx'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /DeleteConfirmAction/);
});

test('组件审计阻断有状态详情缺少标题标签和状态操作', () => {
  const result = runStrictAudit(
    'export function CustomerDetailPage() { return <TemplateDetailPage statusSection={{ items: [] }}><div /></TemplateDetailPage>; }'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /titleTags/);
  assert.match(result.stdout, /statusAction/);
});

test('组件审计阻断详情右上角放置状态操作', () => {
  const result = runStrictAudit(
    'export function CustomerDetailPage() { return <TemplateDetailPage titleTags={<StatusTag />} statusSection={{ items: [] }} statusAction={<AdminTextAction>状态</AdminTextAction>} actions={<StatusChangeAction />}><div /></TemplateDetailPage>; }'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /状态操作.*statusAction/);
});

test('组件审计阻断业务页面直接使用状态弹窗或旧状态动作', () => {
  const modalResult = runStrictAudit('export function CustomerPage() { return <StatusFlowModal open />; }', 'CustomerPage.tsx');
  const legacyResult = runStrictAudit('export function CustomerPage() { return <StatusFlowAction />; }', 'CustomerPage.tsx');
  assert.equal(modalResult.status, 1);
  assert.equal(legacyResult.status, 1);
  assert.match(modalResult.stdout, /StatusChangeAction/);
  assert.match(legacyResult.stdout, /StatusFlowAction/);
});

test('组件审计允许完整的通用详情语义结构', () => {
  const result = runStrictAudit(
    'export function CustomerDetailPage() { return <TemplateDetailPage title="客户详情" titleTags={<StatusTag status="enabled" />} actions={<AdminButton>编辑</AdminButton>} statusSection={{ items: [{ label: "状态", value: "启用" }] }} statusAction={<StatusConfirmAction action="disable">停用</StatusConfirmAction>}><div /></TemplateDetailPage>; }'
  );
  assert.equal(result.status, 0, result.stdout);
});
