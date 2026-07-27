const product = require('../controllers/productController')
const project = require('../controllers/projectController')
const stagePlan = require('../controllers/projectStagePlanController')
const contract = require('../controllers/projectContractController')
const requirement = require('../controllers/requirementController')
const task = require('../controllers/taskController')
const bug = require('../controllers/bugController')
const workOrder = require('../controllers/workOrderController')
const { invokeController } = require('./controllerAdapter')
const { analyzeBusinessData } = require('../services/mcpAnalysisService')
const fileResources = require('./fileResources')

const handlers = {
  product_search: [product.list, (a) => ({ query: normalizeQuery(a) })],
  product_get: [product.getById, (a) => ({ params: { id: requireId(a) } })],
  product_history: [product.history, (a) => ({ params: { id: requireId(a) } })],
  project_search: [project.list, buildProjectSearchInput],
  project_get: [project.getById, (a) => ({ params: { id: requireId(a) } })],
  project_history: [project.history, (a) => ({ params: { id: requireId(a) } })],
  stage_plan_get: [stagePlan.getPlan, (a) => ({ params: { projectId: requireProjectId(a) } })],
  stage_plan_history: [stagePlan.history, (a) => ({ params: { projectId: requireProjectId(a) } })],
  contract_get: [contract.getByProject, (a) => ({ params: { id: requireProjectId(a) } })],
  payment_search: [contract.listPayments, (a) => ({ params: { id: requireProjectId(a), stageId: required(a.stage_id, 'stage_id') } })],
  requirement_search: [requirement.list, (a) => ({ query: normalizeQuery(a) })],
  requirement_get: [requirement.getById, (a) => ({ params: { id: requireId(a) } })],
  requirement_history: [requirement.history, (a) => ({ params: { id: requireId(a) } })],
  task_search: [task.list, (a) => ({ query: normalizeQuery(a) })],
  task_get: [task.getById, (a) => ({ params: { id: requireId(a) } })],
  task_history: [task.history, (a) => ({ params: { id: requireId(a) } })],
  bug_search: [bug.list, (a) => ({ query: normalizeQuery(a) })],
  bug_get: [bug.getById, (a) => ({ params: { id: requireId(a) } })],
  bug_history: [bug.history, (a) => ({ params: { id: requireId(a) } })],
  work_order_search: [workOrder.list, (a) => ({ query: normalizeQuery(a) })],
  work_order_get: [workOrder.getById, (a) => ({ params: { id: requireId(a) } })],
  work_order_history: [workOrder.getHistory, (a) => ({ params: { id: requireId(a) } })],
}

function required(value, name) {
  if (value === undefined || value === null || value === '') throw new Error(`缺少参数 ${name}`)
  return value
}

function requireId(args) {
  return required(args.id, 'id')
}

function requireProjectId(args) {
  return required(args.project_id, 'project_id')
}

function normalizeQuery(args) {
  const query = { ...args }
  if (query.page_size !== undefined) {
    query.pageSize = Math.min(100, Math.max(1, Number(query.page_size) || 20))
    delete query.page_size
  }
  return query
}

function buildProjectSearchInput(args, context) {
  const query = normalizeQuery(args)
  delete query.view
  query.current_user_id = context.user.id
  if (args.view === 'mine') query.owner_id = context.user.id
  if (args.view === 'joined') query.joined_user_id = context.user.id
  return { query }
}

function unwrapEnvelope(envelope) {
  if (!envelope || typeof envelope.code !== 'number') return envelope
  if (envelope.code !== 0) {
    const error = new Error(envelope.message || '业务查询失败')
    error.code = envelope.code
    error.fieldErrors = envelope.fieldErrors
    throw error
  }
  return envelope.data
}

async function dispatchQueryTool(name, args, context) {
  if (name === 'business_analyze') return analyzeBusinessData(args)
  if (name === 'contract_attachment_read') {
    const projectId = required(args.project_id, 'project_id')
    const attachmentId = required(args.attachment_id, 'attachment_id')
    return fileResources.readResource(
      `pmis://projects/${projectId}/contract/attachments/${attachmentId}`,
      context
    )
  }
  if (name === 'stage_delivery_read') {
    const projectId = required(args.project_id, 'project_id')
    const itemId = required(args.item_id, 'item_id')
    const fileId = required(args.file_id, 'file_id')
    return fileResources.readResource(
      `pmis://projects/${projectId}/stage-plan/items/${itemId}/files/${fileId}`,
      context
    )
  }
  const definition = handlers[name]
  if (!definition) throw new Error('查询工具不存在或无权限')
  const [handler, buildInput] = definition
  return unwrapEnvelope(await invokeController(handler, context, buildInput(args, context)))
}

module.exports = { buildProjectSearchInput, dispatchQueryTool, normalizeQuery, unwrapEnvelope }
