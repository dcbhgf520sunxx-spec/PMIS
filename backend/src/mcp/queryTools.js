const product = require('../controllers/productController')
const project = require('../controllers/projectController')
const stagePlan = require('../controllers/projectStagePlanController')
const contract = require('../controllers/projectContractController')
const requirement = require('../controllers/requirementController')
const task = require('../controllers/taskController')
const bug = require('../controllers/bugController')
const workOrder = require('../controllers/workOrderController')
const db = require('../db')
const { invokeController } = require('./controllerAdapter')
const { analyzeBusinessData } = require('../services/mcpAnalysisService')

const GLOBAL_SEARCH_TOOLS = [
  ['/products', 'product_search'],
  ['/projects', 'project_search'],
  ['/projects', 'stage_plan_search'],
  ['/projects', 'contract_search'],
  ['/projects', 'payment_search'],
  ['/requirements', 'requirement_search'],
  ['/tasks', 'task_search'],
  ['/bugs', 'bug_search'],
  ['/work-orders', 'work_order_search'],
]
const GLOBAL_KEYWORD_FIELDS = {
  product_search: 'name',
  project_search: 'name',
  stage_plan_search: 'keyword',
  contract_search: 'keyword',
  payment_search: 'keyword',
  requirement_search: 'title',
  task_search: 'name',
  bug_search: 'title',
  work_order_search: 'problem_desc',
}

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

function buildGlobalSearchPlan(args, context) {
  const pageSize = Math.min(100, Math.max(1, Number(args.page_size) || 20))
  const keyword = String(args.keyword || '').trim()
  return GLOBAL_SEARCH_TOOLS
    .filter(([menuPath]) => context.allowedMenuPaths.has(menuPath))
    .map(([, name]) => ({
      name,
      args: {
        ...(keyword ? { [GLOBAL_KEYWORD_FIELDS[name]]: keyword } : {}),
        page_size: pageSize,
      },
    }))
}

function normalizePage(args) {
  const page = Math.max(1, Number(args.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(args.page_size) || 20))
  return { page, pageSize, offset: (page - 1) * pageSize }
}

function positiveId(value) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function sortClause(args, allowed, fallback) {
  const column = allowed[args.sort_field]
  if (!column) return fallback
  return `${column} ${String(args.sort_order).toLowerCase() === 'asc' ? 'ASC' : 'DESC'}`
}

async function runPagedSearch({ args, database, from, select, where, params, orderBy }) {
  const { page, pageSize, offset } = normalizePage(args)
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : ''
  const count = await database.prepare(`SELECT COUNT(*)::INTEGER total ${from}${clause}`).get(...params)
  const items = await database.prepare(`SELECT ${select} ${from}${clause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset)
  return { items, total: Number(count?.total || 0), page, pageSize }
}

async function searchStagePlans(args = {}, database = db) {
  const where = ['p.is_deleted = 0', 's.is_deleted = 0', 'i.is_deleted = 0']
  const params = []
  const keyword = String(args.keyword || '').trim()
  if (keyword) {
    where.push(`(p.name ILIKE ? OR s.name ILIKE ? OR COALESCE(s.description, '') ILIKE ?
      OR i.name ILIKE ? OR COALESCE(i.remark, '') ILIKE ? OR COALESCE(i.delivery_requirement, '') ILIKE ?)`)
    params.push(...Array(6).fill(`%${keyword}%`))
  }
  const projectId = positiveId(args.project_id)
  if (projectId) { where.push('p.id = ?'); params.push(projectId) }
  const ownerId = positiveId(args.owner_id)
  if (ownerId) { where.push('i.owner_id = ?'); params.push(ownerId) }
  if (args.status !== undefined && args.status !== null && args.status !== '') {
    where.push('i.status = ?')
    params.push(Number(args.status))
  }
  if (args.is_overdue !== undefined && args.is_overdue !== null && args.is_overdue !== '') {
    const overdue = '(i.status IN (0, 1) AND i.current_due_date < CURRENT_DATE)'
    where.push(Number(args.is_overdue) === 1 || args.is_overdue === true ? overdue : `NOT ${overdue}`)
  }
  return runPagedSearch({
    args,
    database,
    from: `FROM pms_project_plan_item i
      JOIN pms_project_plan_stage s ON s.id = i.stage_id
      JOIN pms_project p ON p.id = s.project_id
      LEFT JOIN pms_user owner ON owner.id = i.owner_id`,
    select: `i.id, i.stage_id, s.name stage_name, p.id project_id, p.name project_name,
      i.name item_name, s.description stage_description, i.remark, i.delivery_requirement,
      i.owner_id, owner.real_name owner_name, i.status,
      i.original_due_date, i.current_due_date, i.actual_end_date, i.requires_delivery_file,
      i.created_at, i.updated_at`,
    where,
    params,
    orderBy: sortClause(args, {
      project_name: 'p.name',
      stage_name: 's.name',
      item_name: 'i.name',
      status: 'i.status',
      current_due_date: 'i.current_due_date',
      created_at: 'i.created_at',
    }, 'p.name ASC, s.sort_order ASC, i.sort_order ASC, i.id ASC'),
  })
}

async function searchContracts(args = {}, database = db) {
  const where = ['c.is_deleted = 0', 'p.is_deleted = 0']
  const params = []
  const keyword = String(args.keyword || '').trim()
  if (keyword) {
    where.push('(p.name ILIKE ? OR c.contract_code ILIKE ? OR c.contract_name ILIKE ? OR supplier.name ILIKE ? OR COALESCE(c.remark, \'\') ILIKE ?)')
    params.push(...Array(5).fill(`%${keyword}%`))
  }
  const projectId = positiveId(args.project_id)
  if (projectId) { where.push('p.id = ?'); params.push(projectId) }
  const supplierId = positiveId(args.supplier_id)
  if (supplierId) { where.push('c.supplier_id = ?'); params.push(supplierId) }
  if (args.signed_date_from) { where.push('c.signed_date >= ?'); params.push(args.signed_date_from) }
  if (args.signed_date_to) { where.push('c.signed_date <= ?'); params.push(args.signed_date_to) }
  return runPagedSearch({
    args,
    database,
    from: `FROM pms_project_contract c
      JOIN pms_project p ON p.id = c.project_id
      JOIN pms_archive supplier ON supplier.id = c.supplier_id`,
    select: `c.id, c.project_id, p.name project_name, c.contract_code, c.contract_name,
      c.supplier_id, supplier.name supplier_name, c.signed_date, c.contract_amount, c.remark,
      COALESCE((SELECT SUM(r.payment_amount) FROM pms_project_payment_record r
        JOIN pms_project_payment_stage s ON s.id = r.stage_id AND s.is_deleted = 0
        WHERE s.contract_id = c.id AND r.is_deleted = 0), 0) paid_amount,
      c.contract_amount - COALESCE((SELECT SUM(r.payment_amount) FROM pms_project_payment_record r
        JOIN pms_project_payment_stage s ON s.id = r.stage_id AND s.is_deleted = 0
        WHERE s.contract_id = c.id AND r.is_deleted = 0), 0) unpaid_amount,
      c.created_at, c.updated_at`,
    where,
    params,
    orderBy: sortClause(args, {
      project_name: 'p.name',
      contract_code: 'c.contract_code',
      contract_name: 'c.contract_name',
      signed_date: 'c.signed_date',
      contract_amount: 'c.contract_amount',
      created_at: 'c.created_at',
    }, 'c.signed_date DESC, c.id DESC'),
  })
}

async function searchPayments(args = {}, database = db) {
  const where = [
    'r.is_deleted = 0',
    's.is_deleted = 0',
    'c.is_deleted = 0',
    'p.is_deleted = 0',
  ]
  const params = []
  const keyword = String(args.keyword || '').trim()
  if (keyword) {
    where.push('(p.name ILIKE ? OR c.contract_code ILIKE ? OR c.contract_name ILIKE ? OR s.stage_name ILIKE ? OR handler.real_name ILIKE ? OR COALESCE(r.remark, \'\') ILIKE ?)')
    params.push(...Array(6).fill(`%${keyword}%`))
  }
  for (const [field, column] of [
    ['project_id', 'p.id'],
    ['stage_id', 's.id'],
    ['handler_id', 'r.handler_id'],
  ]) {
    const id = positiveId(args[field])
    if (id) { where.push(`${column} = ?`); params.push(id) }
  }
  if (args.payment_month_from) { where.push('r.payment_month >= ?'); params.push(args.payment_month_from) }
  if (args.payment_month_to) { where.push('r.payment_month <= ?'); params.push(args.payment_month_to) }
  return runPagedSearch({
    args,
    database,
    from: `FROM pms_project_payment_record r
      JOIN pms_project_payment_stage s ON s.id = r.stage_id
      JOIN pms_project_contract c ON c.id = s.contract_id
      JOIN pms_project p ON p.id = c.project_id
      JOIN pms_user handler ON handler.id = r.handler_id
      LEFT JOIN pms_user creator ON creator.id = r.creator_id`,
    select: `r.id, r.stage_id, s.stage_name, c.id contract_id, c.contract_code, c.contract_name,
      p.id project_id, p.name project_name, r.payment_amount, r.payment_month, r.handler_id,
      handler.real_name handler_name, r.remark, creator.real_name creator_name,
      r.created_at, r.updated_at`,
    where,
    params,
    orderBy: sortClause(args, {
      project_name: 'p.name',
      stage_name: 's.stage_name',
      payment_month: 'r.payment_month',
      payment_amount: 'r.payment_amount',
      handler_name: 'handler.real_name',
      created_at: 'r.created_at',
    }, 'r.payment_month DESC, r.id DESC'),
  })
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

async function dispatchQueryTool(name, args, context, dependencies = {}) {
  if (name === 'business_analyze') return analyzeBusinessData(args)
  if (name === 'global_search') {
    const runTool = dependencies.runTool || ((toolName, toolArgs) => dispatchQueryTool(toolName, toolArgs, context, dependencies))
    const entries = await Promise.all(buildGlobalSearchPlan(args, context).map(async ({ name: toolName, args: toolArgs }) => [
      toolName,
      await runTool(toolName, toolArgs),
    ]))
    return {
      keyword: String(args.keyword || '').trim() || null,
      results: Object.fromEntries(entries),
    }
  }
  if (name === 'stage_plan_search') return searchStagePlans(args, dependencies.database)
  if (name === 'contract_search') return searchContracts(args, dependencies.database)
  if (name === 'payment_search') return searchPayments(args, dependencies.database)
  const definition = handlers[name]
  if (!definition) throw new Error('查询工具不存在或无权限')
  const [handler, buildInput] = definition
  return unwrapEnvelope(await invokeController(handler, context, buildInput(args, context)))
}

module.exports = {
  buildGlobalSearchPlan,
  buildProjectSearchInput,
  dispatchQueryTool,
  normalizeQuery,
  searchContracts,
  searchPayments,
  searchStagePlans,
  unwrapEnvelope,
}
