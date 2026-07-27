const product = require('../controllers/productController')
const project = require('../controllers/projectController')
const stage = require('../controllers/projectStagePlanController')
const contract = require('../controllers/projectContractController')
const requirement = require('../controllers/requirementController')
const task = require('../controllers/taskController')
const bug = require('../controllers/bugController')
const workOrder = require('../controllers/workOrderController')
const ticketService = require('../services/mcpActionTicketService')
const { redactAuditInput } = require('../services/mcpAuditService')
const { invokeController } = require('./controllerAdapter')
const { unwrapEnvelope } = require('./queryTools')

const highRiskPattern = /(delete|change_status|reorder|adjust|payment|assign|upload)/
const FILE_LIMIT = Number(process.env.MCP_FILE_INLINE_LIMIT || 5 * 1024 * 1024)

function cleanBody(args) {
  const body = { ...args }
  for (const key of [
    'mode', 'confirmation_id', 'idempotency_key', 'id',
    'attachment_id', 'file_id', 'file_name', 'mime_type', 'content_base64', 'files',
  ]) delete body[key]
  return body
}

function id(args, key = 'id') {
  if (args[key] === undefined || args[key] === '') throw new Error(`缺少参数 ${key}`)
  return args[key]
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

async function dispatchActionTool(name, args, context) {
  const definition = actions[name]
  if (!definition) throw new Error('操作工具不存在或无权限')
  const mode = args.mode || 'preview'
  if (!['preview', 'execute'].includes(mode)) throw new Error('mode必须是preview或execute')
  const riskLevel = highRiskPattern.test(name) ? 'high' : 'medium'
  if (mode === 'preview') {
    const preview = {
      tool: name,
      riskLevel,
      operator: { employeeNo: context.user.employeeNo, realName: context.user.realName },
      target: { id: args.id || args.project_id || args.item_id || null },
      changes: redactAuditInput(cleanBody(args)),
    }
    return ticketService.createTicket(context, name, args, preview, riskLevel)
  }
  await ticketService.consumeTicket(context, name, args, args.confirmation_id)
  try {
    const [handler, buildInput] = definition
    return unwrapEnvelope(await invokeController(handler, context, buildInput(args)))
  } catch (error) {
    await ticketService.markTicketFailed(args.confirmation_id)
    throw error
  }
}

module.exports = { actions, dispatchActionTool }
