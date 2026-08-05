import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('产品详情按项目合同方式切换到独立运维合同分类页', async () => {
  const detail = await read('../src/modules/product/pages/ProductDetailPage.tsx');
  const contracts = await read('../src/modules/product/pages/ProductMaintenanceContractListPage.tsx');
  for (const source of [detail, contracts]) {
    assert.match(source, /\{ key: 'basic', title: '基本信息' \}/);
    assert.match(source, /\{ key: 'contract', title: '合同信息' \}/);
  }
  assert.match(detail, /activeKey: 'basic'/);
  assert.match(detail, /products\/\$\{row\.id\}\/maintenance-contracts/);
  assert.doesNotMatch(detail, /getProductMaintenanceContracts|TemplateDetailTableSection<ProductMaintenanceContract>/);
  assert.match(contracts, /activeKey: 'contract'/);
  assert.match(contracts, /getProductMaintenanceContracts/);
  assert.match(contracts, /TemplateDetailTableSection<ProductMaintenanceContract>/);
  assert.match(contracts, /续签运维合同/);
  assert.match(contracts, /OperationColumnActions/);
})

test('运维合同新增编辑详情路由位于产品管理内部', async () => {
  const routes = await read('../src/app/routes.tsx');
  assert.match(routes, /products\/:id\/maintenance-contracts['"]/);
  assert.match(routes, /products\/:id\/maintenance-contracts\/new/);
  assert.match(routes, /products\/:id\/maintenance-contracts\/:contractId\/edit/);
  assert.match(routes, /products\/:id\/maintenance-contracts\/:contractId/);
})

test('运维合同表单复用标准页面、金额时间、供应商和附件组件', async () => {
  const form = await read('../src/modules/product/pages/ProductMaintenanceContractFormPage.tsx');
  for (const label of ['合同编号', '合同名称', '供应商', '签订时间', '服务开始时间', '服务结束时间', '合同金额（元）', '合同附件', '备注']) {
    assert.match(form, new RegExp(label));
  }
  assert.match(form, /TemplateFormPage/);
  assert.match(form, /AdminProFormMoney/);
  assert.match(form, /AdminProFormDatePicker/);
  assert.match(form, /getArchiveOptionsByTypeName\('供应商'\)/);
  assert.match(form, /AdminAttachmentUpload/);
  assert.doesNotMatch(form, /name="productName"|label="所属产品"/);
  assert.match(form, /attachments\.length === 0/);
  assert.match(form, /请至少上传1个合同附件/);
  assert.match(form, /到期前30、15、7天提醒/);
  assert.doesNotMatch(form, /reminderDays|提醒天数/);
  assert.match(form, /name="contractCode"[\s\S]*disabled=\{editing\}/);
})

test('运维合同历史将合同号作为当前值展示并保留其他字段差异', async () => {
  const detail = await read('../src/modules/product/pages/ProductDetailPage.tsx');
  assert.match(detail, /change\.display_mode === 'values'/);
  assert.match(detail, /changeMode: change\.display_mode/);
})

test('运维合同列表以合同编号查看详情并提供编辑、续签、终止和删除操作', async () => {
  const list = await read('../src/modules/product/pages/ProductMaintenanceContractListPage.tsx');
  assert.match(list, /DetailLinkCell/);
  assert.doesNotMatch(list, />查看<\/AdminTextAction>/);
  assert.match(list, /ProductMaintenanceContractStatusChangeAction/);
  assert.match(list, /variant="text"/);
  assert.match(list, /terminateProductMaintenanceContract/);
})

test('运维合同状态以绿色表示生效中、蓝色表示已续签', async () => {
  const status = await read('../src/modules/product/maintenanceContractStatus.tsx');
  assert.match(status, /active: 'success'/);
  assert.match(status, /renewed: 'processing'/);
})

test('运维合同详情展示固定提醒说明、只读附件和公共终止操作', async () => {
  const detail = await read('../src/modules/product/pages/ProductMaintenanceContractDetailPage.tsx');
  const action = await read('../src/modules/product/components/ProductMaintenanceContractStatusChangeAction.tsx');
  assert.match(detail, /TemplateDetailPage/);
  assert.match(detail, /AdminAttachmentUpload/);
  assert.match(detail, /readOnly/);
  assert.match(detail, /到期后每7天提醒一次/);
  assert.match(detail, /ProductMaintenanceContractStatusChangeAction/);
  assert.match(action, /StatusChangeAction/);
  assert.match(action, /terminationDate/);
  assert.match(action, /terminationReason/);
})

test('运维合同前端接口接入真实读写、终止和附件能力', async () => {
  const api = await read('../src/api/productApi.ts');
  assert.match(api, /getProductMaintenanceContracts/);
  assert.match(api, /createProductMaintenanceContract/);
  assert.match(api, /formData\.append\('files',\s*file\)/);
  assert.match(api, /updateProductMaintenanceContract/);
  assert.match(api, /terminateProductMaintenanceContract/);
  assert.match(api, /uploadProductMaintenanceContractAttachment/);
  assert.match(api, /responseType:\s*'blob'/);
})
