import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
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

test('合同新增编辑支持非必填备注并提交到真实接口', async () => {
  const form = await read('../src/modules/project/pages/ProjectContractFormPage.tsx');
  const api = await read('../src/api/projectApi.ts');
  const types = await read('../src/modules/project/types.ts');

  assert.match(form, /AdminProFormTextArea/);
  assert.match(form, /name="remark"\s+label="备注"/);
  assert.doesNotMatch(form, /name="remark"[\s\S]{0,160}required:\s*true/);
  assert.match(api, /remark:\s*values\.remark\s*\|\|\s*null/);
  assert.match(types, /ProjectContractFormValues[\s\S]*remark\?:\s*string/);
});

test('合同详情在金额字段后展示备注且空值显示占位符', async () => {
  const detail = await read('../src/modules/project/pages/ProjectContractDetailPage.tsx');
  const amountFieldStart = detail.indexOf("label: '未付金额（元）'");
  const remarkFieldStart = detail.indexOf("label: '备注'");
  const attachmentFieldStart = detail.indexOf("label: '合同附件'");

  assert.ok(amountFieldStart >= 0 && amountFieldStart < remarkFieldStart);
  assert.ok(remarkFieldStart < attachmentFieldStart);
  assert.match(detail, /\{\s*label:\s*'备注',\s*value:\s*contract\.remark\s*\|\|\s*'-',\s*wide:\s*true\s*\}/);
});

test('合同详情标题不重复展示合同编码', async () => {
  const detail = await read('../src/modules/project/pages/ProjectContractDetailPage.tsx');
  assert.doesNotMatch(detail, /titleCode=\{/);
  assert.match(detail, /\{\s*label:\s*'合同编码',\s*value:\s*contract\.contractCode\s*\}/);
});

test('付款比例人工录入并自动计算计划金额', async () => {
  const calculationPath = new URL('../src/modules/project/projectContractCalculations.ts', import.meta.url);
  assert.equal(existsSync(calculationPath), true, '应提供付款阶段比例计算模块');
  const { calculateStagePlannedAmounts, deriveStagePaymentRatios, isPaymentRatioTotalValid } = await import(calculationPath);

  assert.equal(isPaymentRatioTotalValid(['30.00', '70.00']), true);
  assert.equal(isPaymentRatioTotalValid(['30.00', '69.99']), false);
  assert.deepEqual(calculateStagePlannedAmounts('100.01', ['33.33', '33.33', '33.34']), ['33.33', '33.33', '33.35']);
  assert.deepEqual(deriveStagePaymentRatios('100.00', ['20.00', '80.00']), ['20.00', '80.00']);

  const form = await read('../src/modules/project/pages/ProjectContractFormPage.tsx');
  assert.match(form, /title:\s*'付款比例'/);
  assert.match(form, /render:\s*\(\{\s*field\s*\}\)\s*=>[\s\S]{0,220}name=\{\[field\.name,\s*'paymentRatio'\]\}/);
  assert.match(form, /suffix=["']%["']/);
  assert.match(form, /name="plannedAmount"[\s\S]{0,240}disabled/);
  assert.match(form, /calculateStagePlannedAmounts/);
  assert.match(form, /deriveStagePaymentRatios/);
  assert.match(form, /isPaymentRatioTotalValid/);
});

test('合同详情付款阶段在阶段名称后展示还原后的付款比例', async () => {
  const detail = await read('../src/modules/project/pages/ProjectContractDetailPage.tsx');
  const stageColumnStart = detail.indexOf("title: '阶段'");
  const ratioColumnStart = detail.indexOf("title: '付款比例'");
  const amountColumnStart = detail.indexOf("title: '计划金额（元）'");

  assert.match(detail, /import\s*\{\s*deriveStagePaymentRatios\s*\}\s*from\s*'\.\.\/projectContractCalculations'/);
  assert.match(detail, /deriveStagePaymentRatios\(contract\.contractAmount,\s*contract\.stages\.map\(\(stage\)\s*=>\s*stage\.plannedAmount\)\)/);
  assert.ok(stageColumnStart >= 0 && stageColumnStart < ratioColumnStart);
  assert.ok(ratioColumnStart < amountColumnStart);
  assert.match(detail, /title:\s*'付款比例'[\s\S]{0,220}`\$\{ratio\}%`/);
});

test('付款阶段使用底座受控列宽规格突出阶段名称并收窄金额', async () => {
  const form = await read('../src/modules/project/pages/ProjectContractFormPage.tsx');
  const editableList = await read('../src/components/admin/AdminProFormEditableList/index.tsx');
  const example = await read('../src/modules/design-system/pages/sections/input/EditableDetailListExamples.tsx');

  assert.match(form, /key:\s*'stageName'[\s\S]{0,120}width:\s*'wide'/);
  assert.match(form, /key:\s*'plannedAmount'[\s\S]{0,120}width:\s*'compact'/);
  assert.match(editableList, /width\?:\s*'compact'\s*\|\s*'standard'\s*\|\s*'wide'/);
  assert.match(editableList, /FIELD_WIDTHS/);
  assert.match(example, /width:\s*'wide'/);
  assert.match(example, /width:\s*'compact'/);
});

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

test('合同新增编辑复用底座上传组件并支持多个附件', async () => {
  const form = await read('../src/modules/project/pages/ProjectContractFormPage.tsx');
  const api = await read('../src/api/projectApi.ts');
  const types = await read('../src/modules/project/types.ts');

  const contractSectionStart = form.indexOf('<TemplateFormSection title="合同信息">');
  const attachmentFieldStart = form.indexOf('<AdminFormItem label="合同附件"');
  const paymentSectionStart = form.indexOf('<TemplateFormSection title="付款阶段">');
  assert.ok(contractSectionStart >= 0 && contractSectionStart < attachmentFieldStart);
  assert.ok(attachmentFieldStart < paymentSectionStart);
  assert.doesNotMatch(form, /TemplateFormSection title="合同附件"/);
  assert.match(form, /AdminAttachmentUpload/);
  assert.match(form, /type AdminAttachment/);
  assert.doesNotMatch(form, /\bAdminUpload\b/);
  assert.match(form, /multiple/);
  assert.match(form, /maxCount=\{10\}/);
  assert.match(form, /maxSize=\{maxAttachmentSize\}/);
  assert.match(form, /accept=\{attachmentAccept\}/);
  assert.match(form, /单个文件不超过 20MB，最多 10 个/);
  assert.match(form, /uploadProjectContractAttachment/);
  assert.match(form, /deleteProjectContractAttachment/);
  assert.match(form, /onLoadPreview=/);
  assert.match(form, /loadProjectContractAttachmentPreview/);
  assert.match(form, /await saveProjectContract[\s\S]*setExists\(true\)[\s\S]*uploadProjectContractAttachment/);
  assert.match(api, /attachments:\s*arrayContract\(contractAttachmentContract\)/);
  assert.match(api, /new FormData\(\)/);
  assert.match(api, /formData\.append\('file', file\)/);
  assert.match(api, /responseType:\s*'blob'/);
  assert.match(types, /export type ProjectContractAttachment/);
})

test('合同保存将附件操作关联到同一条变更历史', async () => {
  const form = await read('../src/modules/project/pages/ProjectContractFormPage.tsx');
  const api = await read('../src/api/projectApi.ts');

  assert.match(api, /operation_id/);
  assert.match(api, /x-operation-id/);
  assert.match(form, /const\s+saveResult\s*=\s*await\s+saveProjectContract/);
  assert.match(form, /deleteProjectContractAttachment\(params\.id,\s*attachmentId,\s*saveResult\.operationId\)/);
  assert.match(form, /uploadProjectContractAttachment\(params\.id,\s*attachment\.rawFile as File,\s*saveResult\.operationId\)/);
})

test('合同详情在合同信息最后展示附件并支持下载', async () => {
  const detail = await read('../src/modules/project/pages/ProjectContractDetailPage.tsx');

  const contractInfoStart = detail.indexOf('<DetailMetaList items={[');
  const attachmentFieldStart = detail.indexOf("label: '合同附件'");
  const paymentSectionStart = detail.indexOf('<TemplateDetailTableSection<ProjectPaymentStage>');
  assert.ok(contractInfoStart >= 0 && contractInfoStart < attachmentFieldStart);
  assert.ok(attachmentFieldStart < paymentSectionStart);
  assert.match(detail, /label: '合同附件'[\s\S]*wide: true/);
  assert.match(detail, /AdminAttachmentUpload/);
  assert.match(detail, /readOnly/);
  assert.match(detail, /onLoadPreview=/);
  assert.match(detail, /loadProjectContractAttachmentPreview/);
  assert.match(detail, /downloadProjectContractAttachment/);
  assert.doesNotMatch(detail, /TemplateDetailTableSection<ProjectContractAttachment>/);
})

test('合同详情支持提示付款影响后整体删除合同', async () => {
  const detail = await read('../src/modules/project/pages/ProjectContractDetailPage.tsx');
  const api = await read('../src/api/projectApi.ts');
  const types = await read('../src/modules/project/types.ts');

  assert.match(detail, /DeleteConfirmAction/);
  assert.match(detail, /删除合同/);
  assert.match(detail, /contract\.paymentCount/);
  assert.match(detail, /合同、付款阶段、付款记录和附件/);
  assert.match(detail, /deleteProjectContract\(params\.id\)/);
  assert.match(api, /payment_count/);
  assert.match(api, /export async function deleteProjectContract/);
  assert.match(api, /request\.delete\(`\/projects\/\$\{projectId\}\/contract`\)/);
  assert.match(types, /paymentCount:\s*number/);
})
