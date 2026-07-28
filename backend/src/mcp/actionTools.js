const product = require('../controllers/productController')
const project = require('../controllers/projectController')
const stage = require('../controllers/projectStagePlanController')
const contract = require('../controllers/projectContractController')
const requirement = require('../controllers/requirementController')
const task = require('../controllers/taskController')
const bug = require('../controllers/bugController')
const workOrder = require('../controllers/workOrderController')
const db = require('../db')
const ticketService = require('../services/mcpActionTicketService')
const { redactAuditInput } = require('../services/mcpAuditService')
const { invokeController } = require('./controllerAdapter')
const { unwrapEnvelope } = require('./queryTools')

const highRiskPattern = /(delete|change_status|reorder|adjust|payment|assign|upload|batch)/
const FILE_LIMIT = Number(process.env.MCP_FILE_INLINE_LIMIT || 5 * 1024 * 1024)
const MAIN_TARGETS = {
  product: {
    table: 'pms_product',
    nameColumn: 'name',
    currentFields: ['status', 'owner_id'],
  },
  project: {
    table: 'pms_project',
    nameColumn: 'name',
    currentFields: ['status', 'product_id', 'owner_id', 'expected_end_date'],
  },
  requirement: {
    table: 'pms_requirement',
    nameColumn: 'title',
    currentFields: ['status', 'requirement_type', 'product_id', 'project_id', 'owner_id'],
  },
  task: {
    table: 'pms_task',
    nameColumn: 'name',
    currentFields: ['status', 'source_type', 'project_id', 'requirement_id'],
  },
  bug: {
    table: 'pms_bug',
    nameColumn: 'title',
    currentFields: ['status', 'source_type', 'project_id', 'requirement_id', 'assignee_id'],
  },
  work_order: {
    table: 'pms_work_order',
    nameColumn: "LEFT(COALESCE(problem_desc, ''), 200)",
    currentFields: ['status', 'product_id', 'problem_type', 'follower_id', 'urgency', 'expected_resolve_date'],
  },
}
const TARGET_LABELS = {
  product: '产品',
  project: '项目',
  requirement: '需求',
  task: '任务',
  bug: 'BUG',
  work_order: '工单',
  stage: '阶段',
  stage_item: '关键事项',
  contract: '项目合同',
  payment: '付款记录',
  contract_attachment: '合同附件',
  stage_delivery: '交付文件',
}

function cleanBody(args) {
  const body = { ...args }
  for (const key of [
    'mode', 'confirmation_id', 'idempotency_key', 'id',
    'attachment_id', 'file_id', 'file_name', 'mime_type', 'content_base64', 'files',
  ]) delete body[key]
  return body
}

function buildPreviewChanges(args) {
  const changes = { ...args }
  for (const key of ['mode', 'confirmation_id', 'idempotency_key']) delete changes[key]
  return redactAuditInput(changes)
}

function id(args, key = 'id') {
  if (args[key] === undefined || args[key] === '') throw new Error(`缺少参数 ${key}`)
  return args[key]
}

function currentSnapshot(row, fields) {
  return Object.fromEntries(fields.map((field) => [field, row[field]]))
}

async function loadOneTarget(database, {
  sql,
  params,
  type,
  missingMessage,
  currentFields = [],
}) {
  const row = await database.prepare(sql).get(...params)
  if (!row) throw new Error(missingMessage)
  return {
    type,
    id: row.id,
    name: row.name,
    current: currentSnapshot(row, currentFields),
  }
}

function mainTargetType(name) {
  return Object.keys(MAIN_TARGETS).find((prefix) => name.startsWith(`${prefix}_`))
}

async function loadMainTargetSnapshot(name, args, database) {
  const type = mainTargetType(name)
  if (!type) return null
  const spec = MAIN_TARGETS[type]
  const label = TARGET_LABELS[type]
  if (name === `${type}_create`) {
    return { type, id: null, name: args.name || args.title || args.problem_desc || null, current: null }
  }
  const targetIds = name === `${type}_assign` ? args.ids : null
  if (Array.isArray(targetIds)) {
    const ids = [...new Set(targetIds.map(Number))]
    const rows = ids.length
      ? await database.prepare(`SELECT id, ${spec.nameColumn} name, ${spec.currentFields.join(', ')}
        FROM ${spec.table} WHERE id IN (${ids.map(() => '?').join(',')}) AND is_deleted = 0`).all(...ids)
      : []
    if (rows.length !== ids.length) throw new Error(`部分${label}不存在或已删除`)
    return {
      type,
      ids,
      name: `${ids.length}条${label}`,
      current: rows.map((row) => ({
        id: row.id,
        name: row.name,
        ...currentSnapshot(row, spec.currentFields),
      })),
    }
  }
  const targetId = name === 'task_create_subtask' ? args.parent_id : args.id
  return loadOneTarget(database, {
    sql: `SELECT id, ${spec.nameColumn} name, ${spec.currentFields.join(', ')}
      FROM ${spec.table} WHERE id = ? AND is_deleted = 0`,
    params: [targetId],
    type,
    missingMessage: `${label}不存在`,
    currentFields: spec.currentFields,
  })
}

async function loadActionTargetSnapshot(name, args, database = db) {
  const main = await loadMainTargetSnapshot(name, args, database)
  if (main) return main

  if (name === 'stage_create' || name === 'stage_reorder') {
    return loadOneTarget(database, {
      sql: 'SELECT id, name, status FROM pms_project WHERE id = ? AND is_deleted = 0',
      params: [args.project_id],
      type: 'project',
      missingMessage: '项目不存在',
      currentFields: ['status'],
    })
  }
  if (name === 'stage_update' || name === 'stage_delete') {
    return loadOneTarget(database, {
      sql: `SELECT s.id, s.name, s.sort_order, s.project_id
        FROM pms_project_plan_stage s
        JOIN pms_project p ON p.id = s.project_id AND p.is_deleted = 0
        WHERE s.id = ? AND s.project_id = ? AND s.is_deleted = 0`,
      params: [args.stage_id, args.project_id],
      type: 'stage',
      missingMessage: '阶段不存在',
      currentFields: ['project_id', 'sort_order'],
    })
  }
  if (name === 'stage_item_create' || name === 'stage_item_batch_create' || name === 'stage_item_reorder') {
    return loadOneTarget(database, {
      sql: `SELECT s.id, s.name, s.sort_order, s.project_id
        FROM pms_project_plan_stage s
        JOIN pms_project p ON p.id = s.project_id AND p.is_deleted = 0
        WHERE s.id = ? AND s.project_id = ? AND s.is_deleted = 0`,
      params: [args.stage_id, args.project_id],
      type: 'stage',
      missingMessage: '阶段不存在',
      currentFields: ['project_id', 'sort_order'],
    })
  }
  if (name.startsWith('stage_item_')) {
    return loadOneTarget(database, {
      sql: `SELECT i.id, i.name, i.status, i.owner_id, i.current_due_date, i.stage_id, s.project_id
        FROM pms_project_plan_item i
        JOIN pms_project_plan_stage s ON s.id = i.stage_id AND s.is_deleted = 0
        JOIN pms_project p ON p.id = s.project_id AND p.is_deleted = 0
        WHERE i.id = ? AND s.project_id = ? AND i.is_deleted = 0`,
      params: [args.item_id, args.project_id],
      type: 'stage_item',
      missingMessage: '关键事项不存在',
      currentFields: ['status', 'owner_id', 'current_due_date', 'stage_id', 'project_id'],
    })
  }
  if (name === 'contract_create') {
    return loadOneTarget(database, {
      sql: 'SELECT id, name, status FROM pms_project WHERE id = ? AND is_deleted = 0',
      params: [args.project_id],
      type: 'project',
      missingMessage: '项目不存在',
      currentFields: ['status'],
    })
  }
  if (name === 'contract_update' || name === 'contract_delete' || name === 'contract_attachment_upload') {
    return loadOneTarget(database, {
      sql: `SELECT c.id, c.contract_name name, c.contract_code, c.contract_amount, c.project_id
        FROM pms_project_contract c
        JOIN pms_project p ON p.id = c.project_id AND p.is_deleted = 0
        WHERE c.project_id = ? AND c.is_deleted = 0`,
      params: [args.project_id],
      type: 'contract',
      missingMessage: '项目合同不存在',
      currentFields: ['project_id', 'contract_code', 'contract_amount'],
    })
  }
  if (name === 'contract_attachment_delete') {
    return loadOneTarget(database, {
      sql: `SELECT a.id, a.original_name name, a.file_size, c.project_id
        FROM pms_project_contract_attachment a
        JOIN pms_project_contract c ON c.id = a.contract_id AND c.is_deleted = 0
        WHERE a.id = ? AND c.project_id = ? AND a.is_deleted = 0`,
      params: [args.attachment_id, args.project_id],
      type: 'contract_attachment',
      missingMessage: '合同附件不存在',
      currentFields: ['project_id', 'file_size'],
    })
  }
  if (name === 'payment_create') {
    return loadOneTarget(database, {
      sql: `SELECT s.id, s.stage_name name, s.planned_amount, c.project_id
        FROM pms_project_payment_stage s
        JOIN pms_project_contract c ON c.id = s.contract_id AND c.is_deleted = 0
        WHERE s.id = ? AND c.project_id = ? AND s.is_deleted = 0`,
      params: [args.stage_id, args.project_id],
      type: 'payment_stage',
      missingMessage: '付款阶段不存在',
      currentFields: ['project_id', 'planned_amount'],
    })
  }
  if (name === 'payment_update' || name === 'payment_delete') {
    return loadOneTarget(database, {
      sql: `SELECT r.id, s.stage_name name, r.payment_amount, r.payment_month, r.handler_id, c.project_id
        FROM pms_project_payment_record r
        JOIN pms_project_payment_stage s ON s.id = r.stage_id AND s.is_deleted = 0
        JOIN pms_project_contract c ON c.id = s.contract_id AND c.is_deleted = 0
        WHERE r.id = ? AND c.project_id = ? AND r.is_deleted = 0`,
      params: [args.payment_id, args.project_id],
      type: 'payment',
      missingMessage: '付款记录不存在',
      currentFields: ['project_id', 'payment_amount', 'payment_month', 'handler_id'],
    })
  }
  if (name === 'stage_delivery_upload') {
    return loadOneTarget(database, {
      sql: `SELECT i.id, i.name, i.status, s.project_id
        FROM pms_project_plan_item i
        JOIN pms_project_plan_stage s ON s.id = i.stage_id AND s.is_deleted = 0
        WHERE i.id = ? AND s.project_id = ? AND i.is_deleted = 0`,
      params: [args.item_id, args.project_id],
      type: 'stage_item',
      missingMessage: '关键事项不存在',
      currentFields: ['project_id', 'status'],
    })
  }
  if (name === 'stage_delivery_delete') {
    return loadOneTarget(database, {
      sql: `SELECT f.id, f.original_name name, f.size_bytes, s.project_id, f.plan_item_id item_id
        FROM pms_project_plan_delivery_file f
        JOIN pms_project_plan_item i ON i.id = f.plan_item_id AND i.is_deleted = 0
        JOIN pms_project_plan_stage s ON s.id = i.stage_id AND s.is_deleted = 0
        WHERE f.id = ? AND f.plan_item_id = ? AND s.project_id = ? AND f.is_current = 1 AND f.is_void = 0`,
      params: [args.file_id, args.item_id, args.project_id],
      type: 'stage_delivery',
      missingMessage: '交付文件不存在',
      currentFields: ['project_id', 'item_id', 'size_bytes'],
    })
  }
  throw new Error('操作目标类型不受支持')
}

const actions = {
  product_create: [product.create, (a) => ({ body: cleanBody(a) })],
  product_update: [product.update, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  product_change_status: [product.toggleStatus, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  product_delete: [product.remove, (a) => ({ params: { id: id(a) } })],
  project_create: [project.create, (a) => ({ body: cleanBody(a) })],
  project_update: [project.update, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  project_change_status: [project.toggleStatus, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  project_delete: [project.remove, (a) => ({ params: { id: id(a) } })],
  requirement_create: [requirement.create, (a) => ({ body: cleanBody(a) })],
  requirement_update: [requirement.update, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  requirement_change_status: [requirement.toggleStatus, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  requirement_delete: [requirement.remove, (a) => ({ params: { id: id(a) } })],
  task_create: [task.create, (a) => ({ body: cleanBody(a) })],
  task_create_subtask: [task.createSubtask, (a) => ({ params: { id: id(a, 'parent_id') }, body: cleanBody(a) })],
  task_update: [task.update, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  task_assign: [task.batchAssign, (a) => ({ body: cleanBody(a) })],
  task_change_status: [task.toggleStatus, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  task_delete: [task.remove, (a) => ({ params: { id: id(a) } })],
  bug_create: [bug.create, (a) => ({ body: cleanBody(a) })],
  bug_update: [bug.update, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  bug_assign: [bug.batchAssign, (a) => ({ body: cleanBody(a) })],
  bug_change_status: [bug.toggleStatus, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  bug_delete: [bug.remove, (a) => ({ params: { id: id(a) } })],
  work_order_create: [workOrder.create, (a) => ({ body: cleanBody(a) })],
  work_order_update: [workOrder.update, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  work_order_assign: [workOrder.batchAssign, (a) => ({ body: cleanBody(a) })],
  work_order_change_status: [workOrder.toggleStatus, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  work_order_delete: [workOrder.remove, (a) => ({ params: { id: id(a) } })],
  stage_create: [stage.createStage, (a) => ({ params: { projectId: id(a, 'project_id') }, body: cleanBody(a) })],
  stage_update: [stage.updateStage, (a) => ({ params: { projectId: id(a, 'project_id'), stageId: id(a, 'stage_id') }, body: cleanBody(a) })],
  stage_reorder: [stage.reorderStages, (a) => ({ params: { projectId: id(a, 'project_id') }, body: cleanBody(a) })],
  stage_delete: [stage.deleteStage, (a) => ({ params: { projectId: id(a, 'project_id'), stageId: id(a, 'stage_id') } })],
  stage_item_create: [stage.createItem, (a) => ({ params: { projectId: id(a, 'project_id') }, body: cleanBody(a) })],
  stage_item_batch_create: [stage.createItems, (a) => ({ params: { projectId: id(a, 'project_id') }, body: cleanBody(a) })],
  stage_item_update: [stage.updateItem, (a) => ({ params: { projectId: id(a, 'project_id'), itemId: id(a, 'item_id') }, body: cleanBody(a) })],
  stage_item_reorder: [stage.reorderItems, (a) => ({ params: { projectId: id(a, 'project_id'), stageId: id(a, 'stage_id') }, body: cleanBody(a) })],
  stage_item_change_status: [stage.changeStatus, (a) => ({ params: { projectId: id(a, 'project_id'), itemId: id(a, 'item_id') }, body: cleanBody(a), files: buildFiles(a.files) })],
  stage_item_adjust: [stage.createAdjustment, (a) => ({ params: { projectId: id(a, 'project_id'), itemId: id(a, 'item_id') }, body: cleanBody(a) })],
  stage_item_delete: [stage.deleteItem, (a) => ({ params: { projectId: id(a, 'project_id'), itemId: id(a, 'item_id') } })],
  contract_create: [contract.create, (a) => ({ params: { id: id(a, 'project_id') }, body: cleanBody(a) })],
  contract_update: [contract.update, (a) => ({ params: { id: id(a, 'project_id') }, body: cleanBody(a) })],
  contract_delete: [contract.remove, (a) => ({ params: { id: id(a, 'project_id') } })],
  payment_create: [contract.createPayment, (a) => ({ params: { id: id(a, 'project_id'), stageId: id(a, 'stage_id') }, body: cleanBody(a) })],
  payment_update: [contract.updatePayment, (a) => ({ params: { id: id(a, 'project_id'), paymentId: id(a, 'payment_id') }, body: cleanBody(a) })],
  payment_delete: [contract.deletePayment, (a) => ({ params: { id: id(a, 'project_id'), paymentId: id(a, 'payment_id') } })],
  contract_attachment_upload: [contract.uploadAttachment, (a) => ({ params: { id: id(a, 'project_id') }, file: buildFile(a) })],
  contract_attachment_delete: [contract.deleteAttachment, (a) => ({ params: { id: id(a, 'project_id'), attachmentId: id(a, 'attachment_id') } })],
  stage_delivery_upload: [stage.uploadFile, (a) => ({ params: { projectId: id(a, 'project_id'), itemId: id(a, 'item_id') }, file: buildFile(a) })],
  stage_delivery_delete: [stage.deleteFile, (a) => ({ params: { projectId: id(a, 'project_id'), itemId: id(a, 'item_id'), fileId: id(a, 'file_id') } })],
}

function buildFile(args) {
  if (!args.file_name || !args.content_base64) throw new Error('缺少文件名或文件内容')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(args.content_base64) || args.content_base64.length % 4 !== 0) {
    throw new Error('文件内容不是有效的Base64')
  }
  const buffer = Buffer.from(args.content_base64, 'base64')
  if (!buffer.length) throw new Error('文件内容为空')
  if (buffer.length > FILE_LIMIT) throw new Error(`文件过大（上限${FILE_LIMIT}字节）`)
  return { originalname: args.file_name, mimetype: args.mime_type || 'application/octet-stream', size: buffer.length, buffer }
}

function buildFiles(files) {
  return Array.isArray(files) ? files.map(buildFile) : undefined
}

async function dispatchActionTool(name, args, context, dependencies = {}) {
  const actionDefinitions = dependencies.actions || actions
  const actionTicketService = dependencies.ticketService || ticketService
  const loadTarget = dependencies.loadTarget || loadActionTargetSnapshot
  const definition = actionDefinitions[name]
  if (!definition) throw new Error('操作工具不存在或无权限')
  const mode = args.mode || 'preview'
  if (!['preview', 'execute'].includes(mode)) throw new Error('mode必须是preview或execute')
  const riskLevel = highRiskPattern.test(name) ? 'high' : 'medium'
  if (mode === 'preview') {
    const target = await loadTarget(name, args)
    const preview = {
      tool: name,
      riskLevel,
      operator: { employeeNo: context.user.employeeNo, realName: context.user.realName },
      target,
      changes: buildPreviewChanges(args),
    }
    return actionTicketService.createTicket(context, name, args, preview, riskLevel)
  }
  await actionTicketService.consumeTicket(context, name, args, args.confirmation_id)
  try {
    const [handler, buildInput] = definition
    return unwrapEnvelope(await invokeController(handler, context, buildInput(args)))
  } catch (error) {
    await actionTicketService.markTicketFailed(args.confirmation_id)
    throw error
  }
}

module.exports = { actions, dispatchActionTool, loadActionTargetSnapshot }
