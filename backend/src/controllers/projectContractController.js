const db = require('../db')
const fs = require('node:fs')
const { Readable } = require('node:stream')
const { fail, failField, ok } = require('../utils/response')
const {
  buildContractHistoryChanges,
  normalizePaymentMonth,
  toCents,
  validateContractStages,
  validatePaymentAmount,
} = require('../services/projectContractRules')
const { createOperationId } = require('../utils/operationHistory')
const {
  normalizeOriginalName,
  removeAttachmentFile,
  resolveAttachmentPath,
} = require('../services/projectContractAttachmentService')
const {
  loadOssAttachment,
  uploadAttachmentToOss,
} = require('../services/projectContractOssService')

async function findProject(projectId) {
  return db.prepare('SELECT id, name FROM pms_project WHERE id = ? AND is_deleted = 0').get(projectId)
}

async function findSupplier(supplierId) {
  return db.prepare(`SELECT supplier.id, supplier.name
    FROM pms_archive supplier
    JOIN pms_archive_type type ON type.id = supplier.archive_type_id
    WHERE supplier.id = ?
      AND supplier.status = 1
      AND supplier.is_deleted = 0
      AND type.name = '供应商'
      AND type.status = 1
      AND type.is_deleted = 0`).get(supplierId)
}

async function findContract(projectId) {
  return db.prepare(`SELECT c.*, p.name project_name, supplier.name supplier_name,
    COALESCE(SUM(r.payment_amount) FILTER (WHERE r.is_deleted = 0), 0) paid_amount,
    COUNT(r.id) FILTER (WHERE r.is_deleted = 0)::INTEGER payment_count,
    c.contract_amount - COALESCE(SUM(r.payment_amount) FILTER (WHERE r.is_deleted = 0), 0) unpaid_amount
    FROM pms_project_contract c
    JOIN pms_project p ON p.id = c.project_id AND p.is_deleted = 0
    JOIN pms_archive supplier ON supplier.id = c.supplier_id
    LEFT JOIN pms_project_payment_stage s ON s.contract_id = c.id AND s.is_deleted = 0
    LEFT JOIN pms_project_payment_record r ON r.stage_id = s.id AND r.is_deleted = 0
    WHERE c.project_id = ? AND c.is_deleted = 0
    GROUP BY c.id, p.name, supplier.id`).get(projectId)
}

async function findStages(contractId) {
  return db.prepare(`SELECT s.id, s.contract_id, s.stage_name, s.planned_amount, s.sort_order,
    COALESCE(SUM(r.payment_amount) FILTER (WHERE r.is_deleted = 0), 0) paid_amount,
    s.planned_amount - COALESCE(SUM(r.payment_amount) FILTER (WHERE r.is_deleted = 0), 0) unpaid_amount,
    CASE
      WHEN COALESCE(SUM(r.payment_amount) FILTER (WHERE r.is_deleted = 0), 0) = 0 THEN 0
      WHEN COALESCE(SUM(r.payment_amount) FILTER (WHERE r.is_deleted = 0), 0) < s.planned_amount THEN 1
      ELSE 2
    END payment_status
    FROM pms_project_payment_stage s
    LEFT JOIN pms_project_payment_record r ON r.stage_id = s.id AND r.is_deleted = 0
    WHERE s.contract_id = ? AND s.is_deleted = 0
    GROUP BY s.id
    ORDER BY s.sort_order, s.id`).all(contractId)
}

async function findAttachments(contractId) {
  return db.prepare(`SELECT attachment.id, attachment.contract_id, attachment.original_name, attachment.mime_type,
    attachment.file_size, attachment.sort_order, attachment.created_at, creator.real_name creator_name
    FROM pms_project_contract_attachment attachment
    LEFT JOIN pms_user creator ON creator.id = attachment.creator_id
    WHERE attachment.contract_id = ? AND attachment.is_deleted = 0
    ORDER BY attachment.sort_order, attachment.id`).all(contractId)
}

async function loadContract(projectId) {
  const contract = await findContract(projectId)
  if (!contract) return null
  return { ...contract, stages: await findStages(contract.id), attachments: await findAttachments(contract.id) }
}

async function validateContract(res, projectId, body, excludeContractId) {
  const required = {
    contract_code: '请填写合同编码',
    contract_name: '请填写合同名称',
    supplier_id: '请选择供应商',
    signed_date: '请选择签订时间',
    contract_amount: '请填写合同金额',
  }
  for (const [field, message] of Object.entries(required)) {
    if (body[field] === undefined || body[field] === null || String(body[field]).trim() === '') {
      failField(res, field, message)
      return null
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.signed_date))) {
    failField(res, 'signed_date', '签订时间格式不正确')
    return null
  }
  const supplierId = Number(body.supplier_id)
  if (!Number.isSafeInteger(supplierId) || supplierId <= 0) {
    failField(res, 'supplier_id', '请选择有效的供应商')
    return null
  }
  const stageError = validateContractStages(body.contract_amount, body.stages)
  if (stageError) {
    failField(res, stageError.startsWith('合同金额') ? 'contract_amount' : 'stages', stageError)
    return null
  }
  const project = await findProject(projectId)
  if (!project) {
    fail(res, 404, 404, '项目不存在')
    return null
  }
  const supplier = await findSupplier(supplierId)
  if (!supplier) {
    failField(res, 'supplier_id', '供应商不存在、已停用或不属于供应商档案')
    return null
  }
  const duplicate = excludeContractId
    ? await db.prepare('SELECT id FROM pms_project_contract WHERE contract_code = ? AND is_deleted = 0 AND id <> ?').get(body.contract_code.trim(), excludeContractId)
    : await db.prepare('SELECT id FROM pms_project_contract WHERE contract_code = ? AND is_deleted = 0').get(body.contract_code.trim())
  if (duplicate) {
    failField(res, 'contract_code', '合同编码已存在')
    return null
  }
  return { project, supplier }
}

function contractLogValue(body, supplierName = body.supplier_name) {
  return `${body.contract_code.trim()}｜${body.contract_name.trim()}｜${supplierName}｜${Number(body.contract_amount).toFixed(2)}`
}

async function writeContractHistory(userId, action, projectId, changes, ip, projectName) {
  if (changes.length > 0) return db.writeLogs(userId, action, '项目', projectId, changes, ip, projectName)
  const operationId = createOperationId()
  await db.writeLog(userId, action, '项目', projectId, null, null, null, ip, projectName, operationId)
  return operationId
}

async function resolveContractSaveOperation(req) {
  const operationId = req.get('x-operation-id')
  if (!operationId) return null
  const operation = await db.findOperationLog(operationId, '项目', req.params.id, req.user.id)
  if (!operation || !['新增合同', '编辑合同'].includes(operation.action)) {
    const error = new Error('合同保存操作已失效，请刷新后重试')
    error.statusCode = 400
    throw error
  }
  return operation
}

function attachmentLogValue(attachments) {
  return attachments.map((attachment) => attachment.original_name).join('、')
}

async function writeAttachmentHistory(req, contract, operation, beforeAttachments, afterAttachments, standaloneAction, oldValue, newValue) {
  if (!operation) {
    await db.writeLog(req.user.id, standaloneAction, '项目', req.params.id, 'contract_attachment', oldValue, newValue, req.ip, contract.project_name)
    return
  }
  if (operation.action === '新增合同') return

  await db.upsertOperationFieldLog(
    req.user.id,
    '编辑合同',
    '项目',
    req.params.id,
    'contract_attachment',
    attachmentLogValue(beforeAttachments),
    attachmentLogValue(afterAttachments),
    req.ip,
    contract.project_name,
    operation.operation_id
  )
}

exports.getByProject = async (req, res) => {
  try {
    if (!(await findProject(req.params.id))) return fail(res, 404, 404, '项目不存在')
    ok(res, await loadContract(req.params.id))
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '查询合同失败')
  }
}

exports.create = async (req, res) => {
  try {
    const validated = await validateContract(res, req.params.id, req.body)
    if (!validated) return
    if (await findContract(req.params.id)) return fail(res, 400, 400, '该项目已存在合同')
    const operatorId = req.user.id
    const contractId = await db.transaction(async (tx) => {
      const result = await tx.prepare(`INSERT INTO pms_project_contract
        (project_id, contract_code, contract_name, supplier_id, signed_date, contract_amount, remark, creator_id, updater_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(req.params.id, req.body.contract_code.trim(), req.body.contract_name.trim(), validated.supplier.id, req.body.signed_date, req.body.contract_amount, req.body.remark || null, operatorId, operatorId)
      for (const [index, stage] of req.body.stages.entries()) {
        await tx.prepare(`INSERT INTO pms_project_payment_stage
          (contract_id, stage_name, planned_amount, sort_order, creator_id, updater_id)
          VALUES (?, ?, ?, ?, ?, ?)`)
          .run(result.lastInsertRowid, stage.stage_name.trim(), stage.planned_amount, index, operatorId, operatorId)
      }
      return result.lastInsertRowid
    })
    const operationId = await writeContractHistory(operatorId, '新增合同', req.params.id, [], req.ip, validated.project.name)
    ok(res, { id: contractId, operation_id: operationId })
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '创建合同失败')
  }
}

exports.update = async (req, res) => {
  try {
    const oldContract = await findContract(req.params.id)
    if (!oldContract) return fail(res, 404, 404, '项目合同不存在')
    const validated = await validateContract(res, req.params.id, req.body, oldContract.id)
    if (!validated) return
    const oldStages = await findStages(oldContract.id)
    const oldStageMap = new Map(oldStages.map((stage) => [String(stage.id), stage]))
    const requestedIds = new Set()
    for (const stage of req.body.stages) {
      if (!stage.id) continue
      const oldStage = oldStageMap.get(String(stage.id))
      if (!oldStage) return fail(res, 400, 400, '付款阶段不属于当前合同')
      requestedIds.add(String(stage.id))
      if (toCents(stage.planned_amount) < toCents(oldStage.paid_amount)) {
        return failField(res, 'stages', `付款阶段“${oldStage.stage_name}”的计划金额不能小于已付金额`)
      }
    }
    for (const stage of oldStages) {
      if (!requestedIds.has(String(stage.id)) && toCents(stage.paid_amount) > 0n) {
        return failField(res, 'stages', `已有付款记录的阶段“${stage.stage_name}”不能删除`)
      }
    }
    const operatorId = req.user.id
    await db.transaction(async (tx) => {
      await tx.prepare(`UPDATE pms_project_contract SET contract_code = ?, contract_name = ?, supplier_id = ?, signed_date = ?,
        contract_amount = ?, remark = ?, updater_id = ?, updated_at = NOW() WHERE id = ?`)
        .run(req.body.contract_code.trim(), req.body.contract_name.trim(), validated.supplier.id, req.body.signed_date, req.body.contract_amount, req.body.remark || null, operatorId, oldContract.id)
      await tx.prepare("UPDATE pms_project_payment_stage SET stage_name = '__editing_' || id::text WHERE contract_id = ? AND is_deleted = 0").run(oldContract.id)
      for (const [index, stage] of req.body.stages.entries()) {
        if (stage.id) {
          await tx.prepare(`UPDATE pms_project_payment_stage SET stage_name = ?, planned_amount = ?, sort_order = ?, updater_id = ?, updated_at = NOW()
            WHERE id = ? AND contract_id = ? AND is_deleted = 0`)
            .run(stage.stage_name.trim(), stage.planned_amount, index, operatorId, stage.id, oldContract.id)
        } else {
          await tx.prepare(`INSERT INTO pms_project_payment_stage
            (contract_id, stage_name, planned_amount, sort_order, creator_id, updater_id) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(oldContract.id, stage.stage_name.trim(), stage.planned_amount, index, operatorId, operatorId)
        }
      }
      const removedIds = oldStages.filter((stage) => !requestedIds.has(String(stage.id))).map((stage) => stage.id)
      for (const stageId of removedIds) {
        await tx.prepare('UPDATE pms_project_payment_stage SET is_deleted = 1, updater_id = ?, updated_at = NOW() WHERE id = ?').run(operatorId, stageId)
      }
    })
    const changes = buildContractHistoryChanges({
      oldContract,
      oldStages,
      newContract: req.body,
      newSupplierName: validated.supplier.name,
    })
    const operationId = await writeContractHistory(operatorId, '编辑合同', req.params.id, changes, req.ip, validated.project.name)
    ok(res, { operation_id: operationId })
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '更新合同失败')
  }
}

exports.remove = async (req, res) => {
  try {
    const contract = await findContract(req.params.id)
    if (!contract) return fail(res, 404, 404, '项目合同不存在')
    const operatorId = req.user.id
    const attachments = await db.transaction(async (tx) => {
      const lockedContract = await tx.prepare('SELECT id FROM pms_project_contract WHERE id = ? AND is_deleted = 0 FOR UPDATE').get(contract.id)
      if (!lockedContract) {
        const error = new Error('项目合同不存在')
        error.statusCode = 404
        throw error
      }
      const rows = await tx.prepare(`SELECT storage_name, oss_response
        FROM pms_project_contract_attachment
        WHERE contract_id = ? AND is_deleted = 0`).all(contract.id)
      await tx.prepare(`UPDATE pms_project_payment_record
        SET is_deleted = 1, updater_id = ?, updated_at = NOW()
        WHERE is_deleted = 0 AND stage_id IN (
          SELECT id FROM pms_project_payment_stage WHERE contract_id = ? AND is_deleted = 0
        )`).run(operatorId, contract.id)
      await tx.prepare(`UPDATE pms_project_payment_stage
        SET is_deleted = 1, updater_id = ?, updated_at = NOW()
        WHERE contract_id = ? AND is_deleted = 0`).run(operatorId, contract.id)
      await tx.prepare(`UPDATE pms_project_contract_attachment
        SET is_deleted = 1, updater_id = ?, updated_at = NOW()
        WHERE contract_id = ? AND is_deleted = 0`).run(operatorId, contract.id)
      await tx.prepare(`UPDATE pms_project_contract SET is_deleted = 1, updater_id = ?, updated_at = NOW()
        WHERE id = ? AND is_deleted = 0`).run(operatorId, contract.id)
      return rows
    })
    for (const attachment of attachments) {
      if (!attachment.oss_response) await removeAttachmentFile(attachment.storage_name).catch(console.error)
    }
    await db.writeLog(operatorId, '删除合同', '项目', req.params.id, 'contract', contractLogValue(contract), null, req.ip, contract.project_name)
    ok(res, null)
  } catch (error) {
    if (error.statusCode === 404) return fail(res, 404, 404, error.message)
    console.error(error)
    fail(res, 500, 500, '删除合同失败')
  }
}

function attachmentErrorResponse(res, error, fallback) {
  if (error.statusCode === 400) return fail(res, 400, 400, error.message)
  console.error(error)
  return fail(res, 500, 500, fallback)
}

async function findAttachment(projectId, attachmentId) {
  return db.prepare(`SELECT attachment.*, contract.project_id, project.name project_name
    FROM pms_project_contract_attachment attachment
    JOIN pms_project_contract contract ON contract.id = attachment.contract_id AND contract.is_deleted = 0
    JOIN pms_project project ON project.id = contract.project_id AND project.is_deleted = 0
    WHERE attachment.id = ? AND project.id = ? AND attachment.is_deleted = 0`).get(attachmentId, projectId)
}

exports.uploadAttachment = async (req, res) => {
  try {
    const contract = await findContract(req.params.id)
    if (!contract) return fail(res, 404, 404, '项目合同不存在')
    if (!req.file) return fail(res, 400, 400, '请选择要上传的附件')
    req.file.originalname = normalizeOriginalName(req.file.originalname)
    const operation = await resolveContractSaveOperation(req)
    const beforeAttachments = await findAttachments(contract.id)
    const saved = await uploadAttachmentToOss(req.file)
    const attachmentId = await db.transaction(async (tx) => {
      const lockedContract = await tx.prepare('SELECT id FROM pms_project_contract WHERE id = ? AND is_deleted = 0 FOR UPDATE').get(contract.id)
      if (!lockedContract) {
        const error = new Error('项目合同不存在')
        error.statusCode = 400
        throw error
      }
      const count = await tx.prepare('SELECT COUNT(*) count FROM pms_project_contract_attachment WHERE contract_id = ? AND is_deleted = 0').get(contract.id)
      if (Number(count.count) >= 10) {
        const error = new Error('一份合同最多上传10个附件')
        error.statusCode = 400
        throw error
      }
      const result = await tx.prepare(`INSERT INTO pms_project_contract_attachment
        (contract_id, original_name, storage_name, oss_response, mime_type, file_size, sort_order, creator_id, updater_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(contract.id, req.file.originalname, saved.storageName, JSON.stringify(saved.ossResponse), req.file.mimetype, req.file.buffer.length, Number(count.count), req.user.id, req.user.id)
      return result.lastInsertRowid
    })
    const afterAttachments = await findAttachments(contract.id)
    await writeAttachmentHistory(req, contract, operation, beforeAttachments, afterAttachments, '上传合同附件', null, req.file.originalname)
    const attachment = afterAttachments.find((item) => Number(item.id) === Number(attachmentId))
    ok(res, attachment)
  } catch (error) {
    attachmentErrorResponse(res, error, '上传合同附件失败')
  }
}

exports.downloadAttachment = async (req, res) => {
  try {
    const contract = await findContract(req.params.id)
    if (!contract) return fail(res, 404, 404, '项目合同不存在')
    const attachment = await findAttachment(req.params.id, req.params.attachmentId)
    if (!attachment || Number(attachment.contract_id) !== Number(contract.id)) return fail(res, 404, 404, '合同附件不存在')
    res.setHeader('Content-Type', attachment.mime_type)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(attachment.original_name)}`)
    if (attachment.oss_response) {
      const response = await loadOssAttachment(attachment.oss_response)
      Readable.fromWeb(response.body).pipe(res)
      return
    }
    const filePath = resolveAttachmentPath(attachment.storage_name)
    await fs.promises.access(filePath)
    const stream = fs.createReadStream(filePath)
    stream.on('error', (error) => {
      if (!res.headersSent) attachmentErrorResponse(res, error, '下载合同附件失败')
      else res.destroy(error)
    })
    stream.pipe(res)
  } catch (error) {
    if (error.code === 'ENOENT') return fail(res, 404, 404, '附件文件不存在')
    attachmentErrorResponse(res, error, '下载合同附件失败')
  }
}

exports.deleteAttachment = async (req, res) => {
  try {
    const contract = await findContract(req.params.id)
    if (!contract) return fail(res, 404, 404, '项目合同不存在')
    const attachment = await findAttachment(req.params.id, req.params.attachmentId)
    if (!attachment || Number(attachment.contract_id) !== Number(contract.id)) return fail(res, 404, 404, '合同附件不存在')
    const operation = await resolveContractSaveOperation(req)
    const beforeAttachments = await findAttachments(contract.id)
    await db.prepare(`UPDATE pms_project_contract_attachment SET is_deleted = 1, updater_id = ?, updated_at = NOW()
      WHERE id = ? AND contract_id = ? AND is_deleted = 0`).run(req.user.id, attachment.id, contract.id)
    if (!attachment.oss_response) await removeAttachmentFile(attachment.storage_name).catch(console.error)
    const afterAttachments = await findAttachments(contract.id)
    await writeAttachmentHistory(req, contract, operation, beforeAttachments, afterAttachments, '删除合同附件', attachment.original_name, null)
    ok(res, null)
  } catch (error) {
    attachmentErrorResponse(res, error, '删除合同附件失败')
  }
}

async function findStageContext(projectId, stageId, excludePaymentId) {
  const exclusion = excludePaymentId ? ' AND r.id <> ?' : ''
  const params = excludePaymentId ? [excludePaymentId, projectId, stageId] : [projectId, stageId]
  return db.prepare(`SELECT s.id, s.stage_name, s.planned_amount, c.id contract_id, p.id project_id, p.name project_name,
    COALESCE(SUM(r.payment_amount) FILTER (WHERE r.is_deleted = 0${exclusion}), 0) paid_amount
    FROM pms_project_payment_stage s
    JOIN pms_project_contract c ON c.id = s.contract_id AND c.is_deleted = 0
    JOIN pms_project p ON p.id = c.project_id AND p.is_deleted = 0
    LEFT JOIN pms_project_payment_record r ON r.stage_id = s.id
    WHERE p.id = ? AND s.id = ? AND s.is_deleted = 0
    GROUP BY s.id, c.id, p.id`).get(...params)
}

async function validatePayment(res, projectId, stageId, body, excludePaymentId) {
  if (body.payment_amount === undefined || body.payment_amount === null || String(body.payment_amount).trim() === '') {
    failField(res, 'payment_amount', '请填写本次付款金额')
    return null
  }
  const paymentMonth = normalizePaymentMonth(String(body.payment_month || '').slice(0, 7))
  if (!paymentMonth) {
    failField(res, 'payment_month', '请选择不晚于当前月份的付款时间')
    return null
  }
  if (!body.handler_id) {
    failField(res, 'handler_id', '请选择经办人')
    return null
  }
  const handler = await db.prepare('SELECT id FROM pms_user WHERE id = ? AND status = 1 AND is_deleted = 0').get(body.handler_id)
  if (!handler) {
    failField(res, 'handler_id', '经办人不存在或已停用')
    return null
  }
  const stage = await findStageContext(projectId, stageId, excludePaymentId)
  if (!stage) {
    fail(res, 404, 404, '付款阶段不存在')
    return null
  }
  const unpaid = toCents(stage.planned_amount) - toCents(stage.paid_amount)
  const amountError = validatePaymentAmount(body.payment_amount, Number(unpaid) / 100)
  if (amountError) {
    failField(res, 'payment_amount', amountError)
    return null
  }
  return { stage, paymentMonth }
}

exports.listPayments = async (req, res) => {
  try {
    if (!(await findStageContext(req.params.id, req.params.stageId))) return fail(res, 404, 404, '付款阶段不存在')
    const rows = await db.prepare(`SELECT r.id, r.stage_id, r.payment_amount, r.payment_month, r.handler_id,
      handler.real_name handler_name, r.remark, creator.real_name creator_name, r.created_at, r.updated_at
      FROM pms_project_payment_record r
      JOIN pms_user handler ON handler.id = r.handler_id
      LEFT JOIN pms_user creator ON creator.id = r.creator_id
      WHERE r.stage_id = ? AND r.is_deleted = 0
      ORDER BY r.payment_month DESC, r.id DESC`).all(req.params.stageId)
    ok(res, rows)
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '查询付款明细失败')
  }
}

exports.createPayment = async (req, res) => {
  try {
    const validated = await validatePayment(res, req.params.id, req.params.stageId, req.body)
    if (!validated) return
    const operatorId = req.user.id
    const result = await db.prepare(`INSERT INTO pms_project_payment_record
      (stage_id, payment_amount, payment_month, handler_id, remark, creator_id, updater_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(req.params.stageId, req.body.payment_amount, validated.paymentMonth, req.body.handler_id, req.body.remark || null, operatorId, operatorId)
    await db.writeLog(operatorId, '登记付款', '项目', req.params.id, 'payment', null, `${validated.stage.stage_name}｜${Number(req.body.payment_amount).toFixed(2)}｜${validated.paymentMonth.slice(0, 7)}`, req.ip, validated.stage.project_name)
    ok(res, { id: result.lastInsertRowid })
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '登记付款失败')
  }
}

exports.updatePayment = async (req, res) => {
  try {
    const payment = await db.prepare(`SELECT r.*, s.id stage_id FROM pms_project_payment_record r
      JOIN pms_project_payment_stage s ON s.id = r.stage_id AND s.is_deleted = 0
      JOIN pms_project_contract c ON c.id = s.contract_id AND c.is_deleted = 0
      WHERE r.id = ? AND c.project_id = ? AND r.is_deleted = 0`).get(req.params.paymentId, req.params.id)
    if (!payment) return fail(res, 404, 404, '付款记录不存在')
    const validated = await validatePayment(res, req.params.id, payment.stage_id, req.body, payment.id)
    if (!validated) return
    await db.prepare(`UPDATE pms_project_payment_record SET payment_amount = ?, payment_month = ?, handler_id = ?, remark = ?,
      updater_id = ?, updated_at = NOW() WHERE id = ?`)
      .run(req.body.payment_amount, validated.paymentMonth, req.body.handler_id, req.body.remark || null, req.user.id, payment.id)
    await db.writeLog(req.user.id, '更正付款', '项目', req.params.id, 'payment', Number(payment.payment_amount).toFixed(2), Number(req.body.payment_amount).toFixed(2), req.ip, validated.stage.project_name)
    ok(res, null)
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '更正付款失败')
  }
}

exports.deletePayment = async (req, res) => {
  try {
    const payment = await db.prepare(`SELECT r.id, r.payment_amount, s.stage_name, p.name project_name
      FROM pms_project_payment_record r
      JOIN pms_project_payment_stage s ON s.id = r.stage_id AND s.is_deleted = 0
      JOIN pms_project_contract c ON c.id = s.contract_id AND c.is_deleted = 0
      JOIN pms_project p ON p.id = c.project_id AND p.is_deleted = 0
      WHERE r.id = ? AND p.id = ? AND r.is_deleted = 0`).get(req.params.paymentId, req.params.id)
    if (!payment) return fail(res, 404, 404, '付款记录不存在')
    await db.prepare('UPDATE pms_project_payment_record SET is_deleted = 1, updater_id = ?, updated_at = NOW() WHERE id = ?').run(req.user.id, payment.id)
    await db.writeLog(req.user.id, '删除付款', '项目', req.params.id, 'payment', `${payment.stage_name}｜${Number(payment.payment_amount).toFixed(2)}`, null, req.ip, payment.project_name)
    ok(res, null)
  } catch (error) {
    console.error(error)
    fail(res, 500, 500, '删除付款失败')
  }
}
