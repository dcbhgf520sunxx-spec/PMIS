const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('项目合同附件路由使用单文件 multipart 上传并复用项目权限', () => {
  const routes = read('src/routes/project.js')
  assert.match(routes, /multer/)
  assert.match(routes, /limits:\s*\{\s*fileSize:\s*MAX_ATTACHMENT_SIZE\s*\}/)
  assert.match(routes, /upload\.single\('file'\)/)
  assert.match(routes, /:\id\/contract\/attachments'/)
  assert.match(routes, /:\id\/contract\/attachments\/:attachmentId\/download/)
  assert.match(routes, /router\.delete\('\/:id\/contract\/attachments\/:attachmentId'/)
})

test('合同查询、上传、下载和删除附件均校验合同归属', () => {
  const controller = read('src/controllers/projectContractController.js')
  assert.match(controller, /async function findAttachments\(contractId\)/)
  assert.match(controller, /attachments:\s*await findAttachments\(contract\.id\)/)
  assert.match(controller, /exports\.uploadAttachment/)
  assert.match(controller, /exports\.downloadAttachment/)
  assert.match(controller, /exports\.deleteAttachment/)
  assert.match(controller, /pms_project_contract_attachment/)
  assert.match(controller, /COUNT\(\*\)[\s\S]*contract_id = \?[\s\S]*is_deleted = 0/)
  assert.match(controller, /attachment\.contract_id[\s\S]*contract\.id/)
  assert.match(controller, /Content-Disposition/)
  assert.match(controller, /is_deleted = 1/)
})

test('合同保存历史逐字段记录并将随保存附件关联到同一次操作', () => {
  const controller = read('src/controllers/projectContractController.js')
  const projectController = read('src/controllers/projectController.js')

  assert.match(controller, /buildContractHistoryChanges/)
  assert.match(controller, /createOperationId/)
  assert.match(controller, /operation_id/)
  assert.match(controller, /x-operation-id/)
  assert.match(controller, /upsertOperationFieldLog/)
  assert.match(controller, /'contract_attachment'/)
  assert.match(controller, /action === '新增合同'/)
  assert.doesNotMatch(controller, /'新增合同'[\s\S]{0,180}'contract'[\s\S]{0,180}contractLogValue/)
  assert.doesNotMatch(controller, /'编辑合同'[\s\S]{0,180}'contract'[\s\S]{0,180}contractLogValue/)

  for (const field of [
    'contract_code',
    'contract_name',
    'contract_supplier',
    'contract_signed_date',
    'contract_amount',
    'contract_remark',
    'contract_stages',
    'contract_attachment',
  ]) {
    assert.match(projectController, new RegExp(field))
  }
})

test('删除合同与新增合同一样只记录操作节点而不生成明细', () => {
  const controller = read('src/controllers/projectContractController.js')
  const projectController = read('src/controllers/projectController.js')

  assert.match(
    controller,
    /writeContractHistory\(operatorId,\s*'删除合同',\s*req\.params\.id,\s*\[\]/
  )
  assert.doesNotMatch(
    controller,
    /db\.writeLog\(operatorId,\s*'删除合同',\s*'项目',\s*req\.params\.id,\s*'contract'/
  )
  assert.match(
    projectController,
    /group\.action === '删除合同'\s*\?\s*\[\]\s*:\s*formatHistoryChanges/
  )
})

test('登记和更正付款按同一次操作逐字段记录变更历史', () => {
  const controller = read('src/controllers/projectContractController.js')
  const projectController = read('src/controllers/projectController.js')

  assert.match(controller, /buildPaymentCreationHistoryChanges/)
  assert.match(controller, /buildPaymentHistoryChanges/)
  assert.match(controller, /db\.writeLogs\(operatorId,\s*'登记付款'/)
  assert.match(controller, /db\.writeLogs\(req\.user\.id,\s*'更正付款'/)
  assert.doesNotMatch(
    controller,
    /db\.writeLog\(operatorId,\s*'登记付款',\s*'项目',\s*req\.params\.id,\s*'payment'/
  )
  assert.doesNotMatch(
    controller,
    /db\.writeLog\(req\.user\.id,\s*'更正付款',\s*'项目',\s*req\.params\.id,\s*'payment'/
  )

  for (const [field, label] of [
    ['payment_stage', '付款阶段'],
    ['payment_amount', '本次付款金额（元）'],
    ['payment_month', '付款时间'],
    ['payment_handler', '经办人'],
    ['payment_remark', '备注'],
  ]) {
    assert.match(projectController, new RegExp(`${field}: '${label}'`))
  }
})
