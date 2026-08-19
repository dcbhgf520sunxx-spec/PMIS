const db = require('../db')
const { uploadAttachmentToOss, loadOssAttachment } = require('./projectContractOssService')
const { normalizeOriginalName } = require('./projectContractAttachmentService')

const MAX_BUSINESS_ATTACHMENTS = 10
const businessTypes = Object.freeze({
  requirement: { table: 'pms_requirement', label: '需求' },
  project: { table: 'pms_project', label: '项目' },
  task: { table: 'pms_task', label: '任务' },
  bug: { table: 'pms_bug', label: 'BUG' },
  work_order: { table: 'pms_work_order', label: '运维工单' },
})

function businessError(message, statusCode = 400) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function getBusinessConfig(businessType) {
  const config = businessTypes[businessType]
  if (!config) throw businessError('不支持该业务附件类型')
  return config
}

async function assertBusinessCanAcceptAttachment(connection, businessType, businessId) {
  const config = getBusinessConfig(businessType)
  const business = await connection.prepare(`SELECT id FROM ${config.table} WHERE id=? AND is_deleted=0`).get(businessId)
  if (!business) throw businessError(`${config.label}不存在或已删除`, 404)
  const row = await connection.prepare(`SELECT COUNT(*) total FROM pms_business_attachment
    WHERE business_type=? AND business_id=? AND is_deleted=0`).get(businessType, businessId)
  if (Number(row?.total || 0) >= MAX_BUSINESS_ATTACHMENTS) throw businessError('每条业务数据最多上传10个附件')
  return business
}

async function listBusinessAttachments(connection, businessType, businessId) {
  getBusinessConfig(businessType)
  return connection.prepare(`SELECT id,business_type,business_id,original_name,mime_type,file_size,sort_order,
      creator_id,updater_id,created_at,updated_at
    FROM pms_business_attachment
    WHERE business_type=? AND business_id=? AND is_deleted=0
    ORDER BY sort_order,id`).all(businessType, businessId)
}

async function findBusinessAttachment(connection, businessType, businessId, attachmentId) {
  getBusinessConfig(businessType)
  return connection.prepare(`SELECT * FROM pms_business_attachment
    WHERE id=? AND business_type=? AND business_id=? AND is_deleted=0`).get(attachmentId, businessType, businessId)
}

async function uploadBusinessAttachment(businessType, businessId, file, operatorId, dependencies = {}) {
  const connection = dependencies.db || db
  await assertBusinessCanAcceptAttachment(connection, businessType, businessId)
  if (!file) throw businessError('请选择要上传的附件')
  file.originalname = normalizeOriginalName(file.originalname)
  const upload = dependencies.uploadAttachmentToOss || uploadAttachmentToOss
  const saved = await upload(file)
  const count = await connection.prepare(`SELECT COUNT(*) total FROM pms_business_attachment
    WHERE business_type=? AND business_id=? AND is_deleted=0`).get(businessType, businessId)
  if (Number(count?.total || 0) >= MAX_BUSINESS_ATTACHMENTS) throw businessError('每条业务数据最多上传10个附件')
  const result = await connection.prepare(`INSERT INTO pms_business_attachment
    (business_type,business_id,original_name,mime_type,file_size,storage_key,oss_response,sort_order,creator_id,updater_id)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
    businessType,
    businessId,
    file.originalname,
    file.mimetype,
    file.buffer.length,
    saved.storageName,
    JSON.stringify(saved.ossResponse),
    Number(count?.total || 0),
    operatorId,
    operatorId
  )
  return findBusinessAttachment(connection, businessType, businessId, result.lastInsertRowid)
}

async function deleteBusinessAttachment(connection, businessType, businessId, attachmentId, operatorId) {
  const attachment = await findBusinessAttachment(connection, businessType, businessId, attachmentId)
  if (!attachment) throw businessError('附件不存在', 404)
  await connection.prepare(`UPDATE pms_business_attachment SET is_deleted=1,updater_id=?,updated_at=NOW()
    WHERE id=? AND business_type=? AND business_id=? AND is_deleted=0`).run(operatorId, attachmentId, businessType, businessId)
}

async function softDeleteBusinessAttachments(connection, businessType, businessId, operatorId) {
  getBusinessConfig(businessType)
  await connection.prepare(`UPDATE pms_business_attachment SET is_deleted=1,updater_id=?,updated_at=NOW()
    WHERE business_type=? AND business_id=? AND is_deleted=0`).run(operatorId, businessType, businessId)
}

module.exports = {
  MAX_BUSINESS_ATTACHMENTS,
  assertBusinessCanAcceptAttachment,
  businessTypes,
  deleteBusinessAttachment,
  findBusinessAttachment,
  getBusinessConfig,
  listBusinessAttachments,
  loadOssAttachment,
  softDeleteBusinessAttachments,
  uploadBusinessAttachment,
}
