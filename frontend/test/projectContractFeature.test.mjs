import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('项目详情通过分类导航在基本信息与合同信息页面间切换', async () => {
  const projectDetail = await read('../src/modules/project/pages/ProjectDetailPage.tsx');
  const contractDetail = await read('../src/modules/project/pages/ProjectContractDetailPage.tsx');
  for (const source of [projectDetail, contractDetail]) {
    assert.match(source, /sectionNavigation=\{\{/);
    assert.match(source, /\{ key: 'basic', title: '基本信息' \}/);
    assert.match(source, /\{ key: 'contract', title: '合同信息' \}/);
  }
  assert.match(projectDetail, /activeKey: 'basic'/);
  assert.match(projectDetail, /navigate\(`\/projects\/\$\{row\.id\}\/contract-detail\$\{location\.search\}`\)/);
  assert.match(projectDetail, /sectionKey="project-basic"/);
  assert.match(projectDetail, /sectionKey="project-progress"/);
  assert.doesNotMatch(projectDetail, /target="_blank"/);
  assert.match(contractDetail, /activeKey: 'contract'/);
  assert.match(contractDetail, /navigate\(`\/projects\/\$\{params\.id\}\$\{location\.search\}`\)/);
  assert.match(contractDetail, /sectionKey="contract-basic"/);
  assert.match(contractDetail, /sectionKey="contract-payments"/);
  assert.match(contractDetail, /title="项目详情"/);
  assert.match(contractDetail, /TemplateDetailPage/);
  assert.match(contractDetail, /TemplateDetailTableSection/);
  assert.match(contractDetail, /登记付款/);
  assert.match(contractDetail, /付款明细/);
})

test('合同表单和路由位于项目管理内部', async () => {
  const routes = await read('../src/app/routes.tsx');
  const form = await read('../src/modules/project/pages/ProjectContractFormPage.tsx');
  const api = await read('../src/api/projectApi.ts');
  assert.match(routes, /projects\/:id\/contract/);
  assert.match(routes, /projects\/:id\/contract-detail/);
  for (const label of ['合同编码', '合同名称', '供应商', '签订时间', '合同金额（元）', '付款阶段']) {
    assert.match(form, new RegExp(label));
  }
  assert.doesNotMatch(form, /label="所属项目"/);
  assert.match(form, /AdminProFormSelect/);
  assert.match(form, /getArchiveOptionsByTypeName\('供应商'\)/);
  assert.match(form, /name="supplierId" label="供应商"/);
  assert.match(api, /supplier_id: Number\(values\.supplierId\)/);
  assert.doesNotMatch(api, /supplier_name: values\.supplierName/);
})

test('合同新增编辑的金额输入统一保留两位小数', async () => {
  const form = await read('../src/modules/project/pages/ProjectContractFormPage.tsx');
  const baseInput = await read('../src/components/admin/AdminProFormInput/index.tsx');

  assert.match(form, /AdminProFormMoney/);
  assert.match(form, /<AdminProFormMoney\s+name="contractAmount"/);
  assert.doesNotMatch(form, /<AdminProFormText\s+name="contractAmount"/);
  assert.match(form, /<AdminProFormMoney\s+name="plannedAmount"/);
  assert.match(baseInput, /precision: 2/);
  assert.match(baseInput, /step: 0\.01/);
  assert.match(baseInput, /stringMode: true/);
})

test('合同详情所有金额字段名统一标注元', async () => {
  const detail = await read('../src/modules/project/pages/ProjectContractDetailPage.tsx');
  const paymentDrawer = await read('../src/modules/project/components/ProjectPaymentDrawer.tsx');
  for (const label of ['合同金额（元）', '已付金额（元）', '未付金额（元）', '计划金额（元）', '待付金额（元）']) {
    assert.match(detail, new RegExp(label));
  }
  assert.match(paymentDrawer, /本次付款金额（元）/);
  assert.match(paymentDrawer, /计划金额（元）/);
  assert.match(paymentDrawer, /已付金额（元）/);
  assert.match(paymentDrawer, /待付金额（元）/);
  assert.doesNotMatch(detail, /[¥￥]/);
  assert.doesNotMatch(paymentDrawer, /[¥￥]/);
  assert.doesNotMatch(detail, /title: '计划金额'/);
  assert.doesNotMatch(detail, /title: '已付金额'/);
  assert.doesNotMatch(detail, /title: '待付金额'/);
  assert.doesNotMatch(detail, /label: '合同金额'/);
  assert.doesNotMatch(detail, /label: '已付金额'/);
  assert.doesNotMatch(detail, /label: '未付金额'/);
})

test('付款阶段复用底座可编辑明细表单', async () => {
  const form = await read('../src/modules/project/pages/ProjectContractFormPage.tsx');
  assert.match(form, /AdminProFormEditableList/);
  assert.match(form, /fields=\{stageFields\}/);
  assert.match(form, /TemplateFormSection title="付款阶段"/);
  assert.doesNotMatch(form, /label="付款阶段"/);
  assert.match(form, /title: '阶段名称'/);
  assert.match(form, /title: '计划金额（元）'/);
  assert.doesNotMatch(form, /ProjectPaymentStageEditor/);
  assert.doesNotMatch(form, /columns=/);
  assert.doesNotMatch(form, /addText=/);
  assert.doesNotMatch(form, /minRows=/);
  assert.doesNotMatch(form, /Form\.List/);
})

test('登记付款只包含确认字段且付款时间按月选择', async () => {
  const source = await read('../src/modules/project/components/ProjectPaymentModal.tsx');
  const api = await read('../src/api/projectApi.ts');
  for (const label of ['本次付款金额', '付款时间', '经办人', '备注']) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /picker:\s*'month'/);
  assert.match(api, /typeof value === 'string'/);
  assert.match(api, /\.format\('YYYY-MM'\)/);
})

test('登记付款弹窗在表单前展示付款阶段金额摘要', async () => {
  const source = await read('../src/modules/project/components/ProjectPaymentModal.tsx');

  assert.match(source, /InfoGrid/);
  assert.match(source, /columns=\{3\}/);
  for (const label of ['计划金额（元）', '已付金额（元）', '待付金额（元）']) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /money\(stage\.plannedAmount\)/);
  assert.match(source, /money\(stage\.paidAmount\)/);
  assert.match(source, /money\(stage\.unpaidAmount\)/);
  assert.ok(source.indexOf('<InfoGrid') < source.indexOf('<ProForm<ProjectPaymentFormValues>'));
})

test('登记付款金额使用两位小数并默认带入待付金额', async () => {
  const source = await read('../src/modules/project/components/ProjectPaymentModal.tsx');

  assert.match(source, /AdminProFormMoney/);
  assert.match(source, /name="paymentAmount"/);
  assert.match(source, /label="本次付款金额（元）"/);
  assert.match(source, /paymentAmount:\s*stage\?\.unpaidAmount\.toFixed\(2\)\s*\?\?\s*''/);
  assert.match(source, /\[form, open, payment, stage\]/);
  assert.doesNotMatch(source, /<AdminProFormText\s+name="paymentAmount"/);
})
