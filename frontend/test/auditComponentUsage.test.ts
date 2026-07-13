import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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

function runStrictAuditFiles(files: Record<string, string>) {
  const modulesDir = mkdtempSync(join(tmpdir(), 'component-audit-'));
  for (const [fileName, source] of Object.entries(files)) {
    const filePath = join(modulesDir, fileName);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, source);
  }
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

test('组件审计阻断标准列表缺少列宽、固定列、横向滚动和排序契约', () => {
  const result = runStrictAudit(
    `export function CustomerListPage() {
      const columns = [
        { title: '序号', width: 56, fixed: 'left' },
        { title: '客户名称', dataIndex: 'name' },
        { title: '操作', valueType: 'option', width: 160 }
      ];
      return <TemplateListPage table={{ columns, dataSource: [], pagination: false }} pagination={{}} />;
    }`,
    'CustomerListPage.tsx'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /数值型 width/);
  assert.match(result.stdout, /fixed="left"/);
  assert.match(result.stdout, /fixed="right"/);
  assert.match(result.stdout, /scroll\.x/);
  assert.match(result.stdout, /sorter/);
});

test('组件审计允许列行为完整的标准列表', () => {
  const result = runStrictAudit(
    `export function CustomerListPage() {
      const columns = [
        { title: '序号', width: 56, fixed: 'left' },
        { title: '客户名称', dataIndex: 'name', width: 180, fixed: 'left', sorter: true },
        { title: '创建人', dataIndex: 'creatorName', width: 120, sorter: true },
        { title: '创建时间', dataIndex: 'createdAt', width: 170, sorter: true },
        { title: '操作', valueType: 'option', width: 160, fixed: 'right' }
      ];
      return <TemplateListPage table={{ columns, dataSource: [], pagination: false, scroll: { x: 800 } }} pagination={{}} />;
    }`,
    'CustomerListPage.tsx'
  );
  assert.equal(result.status, 0, result.stdout);
});

test('组件审计阻断标准列表缺少末尾创建字段或字段顺序错误', () => {
  const missing = runStrictAudit(
    `export function CustomerListPage() {
      const columns = [
        { title: '序号', width: 56, fixed: 'left' },
        { title: '客户名称', dataIndex: 'name', width: 180, fixed: 'left', sorter: true },
        { title: '操作', valueType: 'option', width: 160, fixed: 'right' }
      ];
      return <TemplateListPage table={{ columns, dataSource: [], pagination: false, scroll: { x: 800 } }} pagination={{}} />;
    }`,
    'CustomerListPage.tsx'
  );
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /创建人.*创建时间/);

  const wrongOrder = runStrictAudit(
    `export function CustomerListPage() {
      const columns = [
        { title: '序号', width: 56, fixed: 'left' },
        { title: '客户名称', dataIndex: 'name', width: 180, fixed: 'left', sorter: true },
        { title: '创建时间', dataIndex: 'createdAt', width: 170, sorter: true },
        { title: '创建人', dataIndex: 'creatorName', width: 120, sorter: true },
        { title: '操作', valueType: 'option', width: 160, fixed: 'right' }
      ];
      return <TemplateListPage table={{ columns, dataSource: [], pagination: false, scroll: { x: 900 } }} pagination={{}} />;
    }`,
    'CustomerListPage.tsx'
  );
  assert.equal(wrongOrder.status, 1);
  assert.match(wrongOrder.stdout, /最后两个业务列/);
});

test('组件审计检查拆分到 ListColumns 文件中的创建字段', () => {
  const result = runStrictAudit(
    `export function createCustomerListColumns() {
      return [
        { title: '序号', width: 56, fixed: 'left' },
        { title: '客户名称', dataIndex: 'name', width: 180, fixed: 'left', sorter: true },
        { title: '操作', valueType: 'option', width: 160, fixed: 'right' }
      ];
    }`,
    'CustomerListColumns.tsx'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /创建人.*创建时间/);
});

test('组件审计允许访问日志不声明创建人和创建时间', () => {
  const result = runStrictAuditFiles({
    'access-log/AccessLogListPage.tsx': `export function AccessLogListPage() {
      const columns = [
        { title: '序号', width: 56, fixed: 'left' },
        { title: '操作人', dataIndex: 'operatorName', width: 160, fixed: 'left', sorter: true },
        { title: '访问时间', dataIndex: 'visitedAt', width: 170, sorter: true }
      ];
      return <TemplateListPage table={{ columns, dataSource: [], pagination: false, scroll: { x: 600 } }} pagination={{}} />;
    }`
  });
  assert.equal(result.status, 0, result.stdout);
});

test('组件审计阻断标准列表只有部分业务列支持排序', () => {
  const result = runStrictAudit(
    `export function CustomerListPage() {
      const columns = [
        { title: '序号', width: 56, fixed: 'left' },
        { title: '客户名称', dataIndex: 'name', width: 180, fixed: 'left', sorter: true },
        { title: '负责人', dataIndex: 'ownerName', width: 120 },
        { title: '状态', dataIndex: 'status', width: 100, sorter: true },
        { title: '操作', valueType: 'option', width: 160, fixed: 'right' }
      ];
      return <TemplateListPage table={{ columns, dataSource: [], pagination: false, scroll: { x: 800 } }} pagination={{}} />;
    }`,
    'CustomerListPage.tsx'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /除序号列和操作列外.*sorter: true/);
});

test('组件审计阻断列表数据视图 Tab 缺少统计', () => {
  const result = runStrictAudit(
    `export function CustomerListPage() {
      const columns = [
        { title: '客户名称', dataIndex: 'name', width: 180, fixed: 'left', sorter: true }
      ];
      return <TemplateListPage
        titleExtra={<ViewTabs showCounts value="all" onChange={() => undefined} items={[
          { label: '全部客户', value: 'all' },
          { label: '我负责的', value: 'mine' }
        ]} />}
        table={{ columns, dataSource: [], pagination: false, scroll: { x: 400 } }}
        pagination={{}}
      />;
    }`,
    'CustomerListPage.tsx'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /列表数据视图 Tab.*count/);
});

test('组件审计允许非列表场景的 ViewTabs 不带统计', () => {
  const result = runStrictAudit(
    `export function CustomerDetailPage() {
      return <ViewTabs value="base" onChange={() => undefined} items={[
        { label: '基础信息', value: 'base' },
        { label: '操作记录', value: 'history' }
      ]} />;
    }`,
    'CustomerTabsPanel.tsx'
  );
  assert.equal(result.status, 0, result.stdout);
});

test('组件审计阻断列表数据视图不启用统计', () => {
  const result = runStrictAudit(
    `export function CustomerListPage() {
      const columns = [
        { title: '客户名称', dataIndex: 'name', width: 180, fixed: 'left', sorter: true }
      ];
      return <TemplateListPage
        titleExtra={<ViewTabs value="all" onChange={() => undefined} items={[
          { label: '全部客户', value: 'all' },
          { label: '我负责的', value: 'mine' }
        ]} />}
        table={{ columns, dataSource: [], pagination: false, scroll: { x: 400 } }}
        pagination={{}}
      />;
    }`,
    'CustomerListPage.tsx'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /列表页.*showCounts/);
});

test('组件审计阻断有状态详情缺少状态操作', () => {
  const result = runStrictAudit(
    'export function CustomerDetailPage() { return <TemplateDetailPage statusSection={{ items: [] }}><div /></TemplateDetailPage>; }'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /statusAction/);
});

test('组件审计阻断业务页手工维护标题状态标签', () => {
  const result = runStrictAudit(
    'export function CustomerDetailPage() { return <TemplateDetailPage titleTags={<StatusTag />} statusSection={{ items: [] }} statusAction={<StatusConfirmAction />} />; }'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /statusSection\.items.*自动生成/);
});

test('组件审计阻断当前状态区使用自定义 children', () => {
  const result = runStrictAudit(
    'export function CustomerDetailPage() { return <TemplateDetailPage statusSection={{ children: <div>状态</div> }} statusAction={<StatusConfirmAction />} />; }'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /当前状态.*items/);
});

test('组件审计阻断详情右上角放置状态操作', () => {
  const result = runStrictAudit(
    'export function CustomerDetailPage() { return <TemplateDetailPage titleTags={<StatusTag />} statusSection={{ items: [] }} statusAction={<AdminTextAction>状态</AdminTextAction>} actions={<StatusChangeAction />}><div /></TemplateDetailPage>; }'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /状态操作.*statusAction/);
});

test('组件审计阻断详情历史分组继续使用操作历史旧名称', () => {
  const result = runStrictAudit(
    'export function CustomerDetailPage() { return <TemplateDetailPage><TemplateDetailSection title="操作历史"><HistoryTimeline items={[]} /></TemplateDetailSection></TemplateDetailPage>; }'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /HistoryTimeline.*变更历史/);
});

test('组件审计允许详情历史使用统一的变更历史名称', () => {
  const result = runStrictAudit(
    'export function CustomerDetailPage() { return <TemplateDetailPage><HistoryTimelineSection items={[]} /></TemplateDetailPage>; }'
  );
  assert.equal(result.status, 0, result.stdout);
});

test('组件审计阻断业务页手工控制 HistoryTimeline 展开状态', () => {
  const result = runStrictAudit(
    'export function CustomerDetailPage() { return <TemplateDetailPage><TemplateDetailSection title="变更历史"><HistoryTimeline items={[]} expandedKeys={keys} onExpandedKeysChange={setKeys} /></TemplateDetailSection></TemplateDetailPage>; }'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /HistoryTimeline.*全部展开/);
});

test('组件审计阻断开启分类导航后存在未声明 sectionKey 的分组', () => {
  const result = runStrictAudit(
    'export function CustomerDetailPage() { return <TemplateDetailPage sectionNavigation><TemplateDetailSection title="基本信息" sectionKey="basic"><div /></TemplateDetailSection><TemplateDetailSection title="变更历史"><HistoryTimeline items={[]} /></TemplateDetailSection></TemplateDetailPage>; }'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /分类导航.*sectionKey/);
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
    'export function CustomerDetailPage() { return <TemplateDetailPage title="客户详情" actions={<AdminButton>编辑</AdminButton>} statusSection={{ items: [{ label: "状态", value: <StatusTag status="enabled" /> }] }} statusAction={<StatusConfirmAction action="disable">停用</StatusConfirmAction>}><div /></TemplateDetailPage>; }'
  );
  assert.equal(result.status, 0, result.stdout);
});

test('组件审计阻断普通内容冒充详情状态语义', () => {
  const result = runStrictAudit(
    'export function CustomerDetailPage() { return <TemplateDetailPage statusSection={{ items: [{ label: "状态", value: <span>启用</span> }] }} statusAction={<AdminButton>状态</AdminButton>} />; }'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /StatusTag/);
  assert.match(result.stdout, /状态动作/);
});

test('组件审计阻断状态动作页面遗漏状态区', () => {
  const result = runStrictAudit(
    'export function CustomerDetailPage() { return <TemplateDetailPage titleTags={<StatusTag />} statusAction={<StatusConfirmAction action="disable" />} />; }'
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /statusSection/);
});

test('组件审计允许基于标准状态动作扩展的业务状态动作', () => {
  const result = runStrictAuditFiles({
    'customer/pages/CustomerListPage.tsx': 'import { CustomerStatusChangeAction } from "../components/CustomerStatusChangeAction"; export function CustomerListPage() { return <OperationColumnActions><CustomerStatusChangeAction variant="text" /></OperationColumnActions>; }',
    'customer/components/CustomerStatusChangeAction.tsx': 'export function CustomerStatusChangeAction(props) { return <StatusChangeAction {...props} />; }'
  });
  assert.equal(result.status, 0, result.stdout);
});

test('组件审计阻断只改名字但未调用公共组件的业务状态动作', () => {
  const result = runStrictAuditFiles({
    'customer/pages/CustomerListPage.tsx': 'import { CustomerStatusChangeAction } from "../components/CustomerStatusChangeAction"; export function CustomerListPage() { return <OperationColumnActions><CustomerStatusChangeAction variant="text" /></OperationColumnActions>; }',
    'customer/components/CustomerStatusChangeAction.tsx': 'export function CustomerStatusChangeAction() { return <AdminButton>状态变更</AdminButton>; }'
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /公共 StatusChangeAction/);
});
