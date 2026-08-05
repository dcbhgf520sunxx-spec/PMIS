const fs = require('node:fs')
const { Readable } = require('node:stream')
const db = require('../db')
const { fail, failField, ok } = require('../utils/response')
const { getShanghaiDateText } = require('../utils/date')
const {
  buildMaintenanceContractHistoryChanges,
  buildMaintenanceContractTerminationHistoryChanges,
  deriveContractStatus,
  isValidDateText,
  validateContractAttachmentCount,
  validateImmutableContractCode,
  validateContractDates,
} = require('../services/productMaintenanceContractRules')
const { createOperationId } = require('../utils/operationHistory')
const { normalizeOriginalName, removeAttachmentFile, resolveAttachmentPath } = require('../services/projectContractAttachmentService')
const { loadOssAttachment, uploadAttachmentToOss } = require('../services/projectContractOssService')

async function findProduct(productId) {
  return db.prepare('SELECT id, name, owner_id FROM pms_product WHERE id = ? AND is_deleted = 0').get(productId)
}

async function findSupplier(supplierId) {
  return db.prepare(`SELECT supplier.id, supplier.name
    FROM pms_archive supplier
    JOIN pms_archive_type type ON type.id = supplier.archive_type_id
    WHERE supplier.id = ? AND supplier.status = 1 AND supplier.is_deleted = 0
      AND type.name = '供应商' AND type.status = 1 AND type.is_deleted = 0`).get(supplierId)
}

async function findContract(productId, contractId) {
  return db.prepare(`SELECT contract.*, product.name product_name, supplier.name supplier_name,
      predecessor.contract_name previous_contract_name, creator.real_name creator_name, updater.real_name updater_name,
      EXISTS (SELECT 1 FROM pms_product_maintenance_contract successor
        WHERE successor.previous_contract_id = contract.id AND successor.is_deleted = 0) has_successor
    FROM pms_product_maintenance_contract contract
    JOIN pms_product product ON product.id = contract.product_id AND product.is_deleted = 0
    JOIN pms_archive supplier ON supplier.id = contract.supplier_id
    LEFT JOIN pms_product_maintenance_contract predecessor ON predecessor.id = contract.previous_contract_id
    LEFT JOIN pms_user creator ON creator.id = contract.creator_id
    LEFT JOIN pms_user updater ON updater.id = contract.updater_id
    WHERE contract.product_id = ? AND contract.id = ? AND contract.is_deleted = 0`).get(productId, contractId)
}

async function findAttachments(contractId) {
  return db.prepare(`SELECT attachment.id, attachment.contract_id, attachment.original_name, attachment.mime_type,
      attachment.file_size, attachment.sort_order, attachment.created_at, creator.real_name creator_name
    FROM pms_product_maintenance_contract_attachment attachment
    LEFT JOIN pms_user creator ON creator.id = attachment.creator_id
    WHERE attachment.contract_id = ? AND attachment.is_deleted = 0
    ORDER BY attachment.sort_order, attachment.id`).all(contractId)
}

async function countAttachments(contractId) {
  const row = await db.prepare(`SELECT COUNT(*) count FROM pms_product_maintenance_contract_attachment
    WHERE contract_id = ? AND is_deleted = 0`).get(contractId)
  return Number(row.count)
}

function presentContract(contract, todayText = getShanghaiDateText()) {
  return { ...contract, status: deriveContractStatus(contract, todayText) }
}

function handleContractWriteError(res, error, fallbackMessage) {
  if (error?.code === '23505' && error?.constraint === 'uk_product_maintenance_contract_code_active') {
    failField(res, 'contract_code', '合同编号已存在')
    return
  }
  if (error?.code === '23505' && ['uk_product_maintenance_contract_root_active', 'uk_product_maintenance_contract_previous_active'].includes(error?.constraint)) {
    fail(res, 409, 409, '合同记录已发生变化，请刷新后重试')
    return
  }
  console.error(error)
  fail(res, 500, 500, fallbackMessage)
}

async function latestContract(productId, excludeId) {
  const exclusion = excludeId ? ' AND id <> ?' : ''
  const params = excludeId ? [productId, excludeId] : [productId]
  return db.prepare(`SELECT * FROM pms_product_maintenance_contract
    WHERE product_id = ? AND is_deleted = 0${exclusion}
    ORDER BY service_start_date DESC, id DESC LIMIT 1`).get(...params)
}

async function writeMaintenanceContractHistory(userId, action, productId, changes, ip, productName) {
  if (changes.length > 0) return db.writeLogs(userId, action, '产品', productId, changes, ip, productName)
  const operationId = createOperationId()
  await db.writeLog(userId, action, '产品', productId, null, null, null, ip, productName, operationId)
  return operationId
}

async function validateContract(res, productId, body, current) {
  const required = {
    contract_code: '请输入合同编号', contract_name: '请输入合同名称', supplier_id: '请选择供应商',
    signed_date: '请选择签订日期', service_start_date: '请选择服务开始日期',
    service_end_date: '请选择服务结束日期', contract_amount: '请输入合同金额',
  }
  for (const [field, message] of Object.entries(required)) {
    if (body[field] === undefined || body[field] === null || String(body[field]).trim() === '') {
      failField(res, field, message)
      return null
    }
  }
  const contractCodeError = current && validateImmutableContractCode(current.contract_code, body.contract_code)
  if (contractCodeError) { failField(res, 'contract_code', contractCodeError); return null }
  const product = await findProduct(productId)
  if (!product) { fail(res, 404, 404, '产品不存在'); return null }
  const supplier = await findSupplier(Number(body.supplier_id))
  if (!supplier) { failField(res, 'supplier_id', '供应商不存在、已停用或不属于供应商档案'); return null }
  const duplicate = current ? null : await db.prepare('SELECT id FROM pms_product_maintenance_contract WHERE contract_code = ? AND is_deleted = 0').get(body.contract_code.trim())
  if (duplicate) { failField(res, 'contract_code', '合同编号已存在'); return null }
  const amount = Number(body.contract_amount)
  if (!Number.isFinite(amount) || amount <= 0) { failField(res, 'contract_amount', '合同金额必须大于0'); return null }
  if (body.contract_code.trim().length > 100) { failField(res, 'contract_code', '合同编号不能超过100个字符'); return null }
  if (body.contract_name.trim().length > 200) { failField(res, 'contract_name', '合同名称不能超过200个字符'); return null }
  if (!isValidDateText(body.signed_date)) { failField(res, 'signed_date', '请选择有效的签订日期'); return null }

  let predecessor = null
  let successor = null
  if (current?.previous_contract_id) predecessor = await findContract(productId, current.previous_contract_id)
  if (current) {
    successor = await db.prepare(`SELECT * FROM pms_product_maintenance_contract
      WHERE previous_contract_id = ? AND is_deleted = 0`).get(current.id)
  } else {
    predecessor = await latestContract(productId)
  }
  const dateError = validateContractDates({
    serviceStartDate: body.service_start_date,
    serviceEndDate: body.service_end_date,
    previousServiceEndDate: predecessor?.termination_date || predecessor?.service_end_date,
    nextServiceStartDate: successor?.service_start_date,
    terminationDate: current?.termination_date,
    terminationReason: current?.termination_reason,
  })
  if (dateError) {
    const field = dateError.includes('开始') ? 'service_start_date' : 'service_end_date'
    failField(res, field, dateError)
    return null
  }
  return { product, supplier, predecessor }
}

exports.list = async (req, res) => {
  try {
    if (!(await findProduct(req.params.id))) return fail(res, 404, 404, '产品不存在')
    const rows = await db.prepare(`SELECT contract.*, supplier.name supplier_name,
        predecessor.contract_name previous_contract_name,
        EXISTS (SELECT 1 FROM pms_product_maintenance_contract successor
          WHERE successor.previous_contract_id = contract.id AND successor.is_deleted = 0) has_successor
      FROM pms_product_maintenance_contract contract
      JOIN pms_archive supplier ON supplier.id = contract.supplier_id
      LEFT JOIN pms_product_maintenance_contract predecessor ON predecessor.id = contract.previous_contract_id
      WHERE contract.product_id = ? AND contract.is_deleted = 0
      ORDER BY contract.service_start_date DESC, contract.id DESC`).all(req.params.id)
    ok(res, rows.map((row) => presentContract(row)))
  } catch (error) { console.error(error); fail(res, 500, 500, '查询运维合同失败') }
}

exports.getById = async (req, res) => {
  try {
    const contract = await findContract(req.params.id, req.params.contractId)
    if (!contract) return fail(res, 404, 404, '运维合同不存在')
    ok(res, { ...presentContract(contract), attachments: await findAttachments(contract.id) })
  } catch (error) { console.error(error); fail(res, 500, 500, '查询运维合同失败') }
}

exports.create = async (req, res) => {
  try {
    const attachmentError = validateContractAttachmentCount(req.files?.length || 0)
    if (attachmentError) return failField(res, 'attachments', attachmentError)
    const validated = await validateContract(res, req.params.id, req.body)
    if (!validated) return
    const savedAttachments = []
    for (const file of req.files) {
      file.originalname = normalizeOriginalName(file.originalname)
      savedAttachments.push({ file, saved: await uploadAttachmentToOss(file) })
    }
    const contractId = await db.transaction(async (tx) => {
      const result = await tx.prepare(`INSERT INTO pms_product_maintenance_contract
        (product_id, previous_contract_id, contract_code, contract_name, supplier_id, signed_date,
          service_start_date, service_end_date, contract_amount, remark, creator_id, updater_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        req.params.id, validated.predecessor?.id || null, req.body.contract_code.trim(), req.body.contract_name.trim(),
        validated.supplier.id, req.body.signed_date, req.body.service_start_date, req.body.service_end_date,
        req.body.contract_amount, req.body.remark || null, req.user.id, req.user.id
      )
      for (const [index, attachment] of savedAttachments.entries()) {
        await tx.prepare(`INSERT INTO pms_product_maintenance_contract_attachment
          (contract_id, original_name, storage_name, oss_response, mime_type, file_size, sort_order, creator_id, updater_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          result.lastInsertRowid, attachment.file.originalname, attachment.saved.storageName,
          JSON.stringify(attachment.saved.ossResponse), attachment.file.mimetype, attachment.file.buffer.length,
          index, req.user.id, req.user.id
        )
      }
      return result.lastInsertRowid
    })
    await db.writeLog(req.user.id, validated.predecessor ? '续签运维合同' : '新增运维合同', '产品', req.params.id, null, null, null, req.ip, validated.product.name)
    ok(res, { id: contractId })
  } catch (error) {
    if (error.statusCode === 400) return fail(res, 400, 400, error.message)
    handleContractWriteError(res, error, '创建运维合同失败')
  }
}

exports.update = async (req, res) => {
  try {
    const current = await findContract(req.params.id, req.params.contractId)
    if (!current) return fail(res, 404, 404, '运维合同不存在')
    const attachmentError = validateContractAttachmentCount(await countAttachments(current.id))
    if (attachmentError) return failField(res, 'attachments', attachmentError)
    const validated = await validateContract(res, req.params.id, req.body, current)
    if (!validated) return
    await db.prepare(`UPDATE pms_product_maintenance_contract SET contract_name = ?, supplier_id = ?,
      signed_date = ?, service_start_date = ?, service_end_date = ?, contract_amount = ?, remark = ?, updater_id = ?, updated_at = NOW()
      WHERE id = ? AND product_id = ? AND is_deleted = 0`).run(
      req.body.contract_name.trim(), validated.supplier.id, req.body.signed_date,
      req.body.service_start_date, req.body.service_end_date, req.body.contract_amount, req.body.remark || null,
      req.user.id, current.id, req.params.id
    )
    const changes = buildMaintenanceContractHistoryChanges({
      oldContract: current,
      newContract: req.body,
      newSupplierName: validated.supplier.name,
    })
    await writeMaintenanceContractHistory(req.user.id, '编辑运维合同', req.params.id, changes, req.ip, validated.product.name)
    ok(res, null)
  } catch (error) { handleContractWriteError(res, error, '更新运维合同失败') }
}

exports.terminate = async (req, res) => {
  try {
    const contract = await findContract(req.params.id, req.params.contractId)
    if (!contract) return fail(res, 404, 404, '运维合同不存在')
    if (contract.termination_date) return fail(res, 400, 400, '运维合同已终止')
    if (contract.has_successor) return fail(res, 400, 400, '已续签合同不能终止')
    const error = validateContractDates({
      serviceStartDate: contract.service_start_date,
      serviceEndDate: contract.service_end_date,
      terminationDate: req.body.termination_date,
      terminationReason: req.body.termination_reason,
    })
    if (error) return failField(res, error.includes('原因') ? 'termination_reason' : 'termination_date', error)
    await db.prepare(`UPDATE pms_product_maintenance_contract SET termination_date = ?, termination_reason = ?,
      updater_id = ?, updated_at = NOW() WHERE id = ? AND product_id = ? AND is_deleted = 0`).run(
      req.body.termination_date, req.body.termination_reason.trim(), req.user.id, contract.id, req.params.id
    )
    await db.writeLogs(
      req.user.id,
      '终止运维合同',
      '产品',
      req.params.id,
      buildMaintenanceContractTerminationHistoryChanges({
        contractCode: contract.contract_code,
        contractName: contract.contract_name,
        terminationDate: req.body.termination_date,
        terminationReason: req.body.termination_reason,
      }),
      req.ip,
      contract.product_name
    )
    ok(res, null)
  } catch (error) { console.error(error); fail(res, 500, 500, '终止运维合同失败') }
}

exports.remove = async (req, res) => {
  try {
    const contract = await findContract(req.params.id, req.params.contractId)
    if (!contract) return fail(res, 404, 404, '运维合同不存在')
    if (contract.has_successor) return fail(res, 400, 400, '已有续签合同，不能删除历史合同')
    await db.transaction(async (tx) => {
      await tx.prepare(`UPDATE pms_product_maintenance_contract_attachment SET is_deleted = 1, updater_id = ?, updated_at = NOW()
        WHERE contract_id = ? AND is_deleted = 0`).run(req.user.id, contract.id)
      await tx.prepare(`UPDATE pms_product_maintenance_contract SET is_deleted = 1, updater_id = ?, updated_at = NOW()
        WHERE id = ? AND product_id = ? AND is_deleted = 0`).run(req.user.id, contract.id, req.params.id)
    })
    await db.writeLog(req.user.id, '删除运维合同', '产品', req.params.id, null, null, null, req.ip, contract.product_name)
    ok(res, null)
  } catch (error) { console.error(error); fail(res, 500, 500, '删除运维合同失败') }
}

async function findAttachment(productId, contractId, attachmentId) {
  return db.prepare(`SELECT attachment.* FROM pms_product_maintenance_contract_attachment attachment
    JOIN pms_product_maintenance_contract contract ON contract.id = attachment.contract_id AND contract.is_deleted = 0
    WHERE contract.product_id = ? AND contract.id = ? AND attachment.id = ? AND attachment.is_deleted = 0`).get(productId, contractId, attachmentId)
}

exports.uploadAttachment = async (req, res) => {
  try {
    const contract = await findContract(req.params.id, req.params.contractId)
    if (!contract) return fail(res, 404, 404, '运维合同不存在')
    if (!req.file) return fail(res, 400, 400, '请选择要上传的附件')
    req.file.originalname = normalizeOriginalName(req.file.originalname)
    const count = await db.prepare(`SELECT COUNT(*) count FROM pms_product_maintenance_contract_attachment
      WHERE contract_id = ? AND is_deleted = 0`).get(contract.id)
    if (Number(count.count) >= 10) return fail(res, 400, 400, '一份合同最多上传10个附件')
    const saved = await uploadAttachmentToOss(req.file)
    const result = await db.prepare(`INSERT INTO pms_product_maintenance_contract_attachment
      (contract_id, original_name, storage_name, oss_response, mime_type, file_size, sort_order, creator_id, updater_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      contract.id, req.file.originalname, saved.storageName, JSON.stringify(saved.ossResponse), req.file.mimetype,
      req.file.buffer.length, Number(count.count), req.user.id, req.user.id
    )
    const attachment = (await findAttachments(contract.id)).find((item) => Number(item.id) === Number(result.lastInsertRowid))
    ok(res, attachment)
  } catch (error) {
    if (error.statusCode === 400) return fail(res, 400, 400, error.message)
    console.error(error); fail(res, 500, 500, '上传运维合同附件失败')
  }
}

exports.downloadAttachment = async (req, res) => {
  try {
    const attachment = await findAttachment(req.params.id, req.params.contractId, req.params.attachmentId)
    if (!attachment) return fail(res, 404, 404, '运维合同附件不存在')
    res.setHeader('Content-Type', attachment.mime_type)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(attachment.original_name)}`)
    if (attachment.oss_response) {
      const response = await loadOssAttachment(attachment.oss_response)
      Readable.fromWeb(response.body).pipe(res)
      return
    }
    fs.createReadStream(resolveAttachmentPath(attachment.storage_name)).pipe(res)
  } catch (error) { console.error(error); if (!res.headersSent) fail(res, 500, 500, '下载运维合同附件失败') }
}

exports.deleteAttachment = async (req, res) => {
  try {
    const attachment = await findAttachment(req.params.id, req.params.contractId, req.params.attachmentId)
    if (!attachment) return fail(res, 404, 404, '运维合同附件不存在')
    if (validateContractAttachmentCount((await countAttachments(req.params.contractId)) - 1)) {
      return fail(res, 400, 400, '合同附件至少保留1个')
    }
    await db.prepare(`UPDATE pms_product_maintenance_contract_attachment SET is_deleted = 1, updater_id = ?, updated_at = NOW()
      WHERE id = ? AND contract_id = ? AND is_deleted = 0`).run(req.user.id, attachment.id, req.params.contractId)
    if (!attachment.oss_response) await removeAttachmentFile(attachment.storage_name).catch(console.error)
    ok(res, null)
  } catch (error) { console.error(error); fail(res, 500, 500, '删除运维合同附件失败') }
}
