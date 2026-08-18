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
const { allowedProjectStatuses } = require('../services/productProjectRules')
const { allowedRequirementStatuses } = require('../services/requirementRules')
const { allowedTaskStatuses } = require('../services/taskRules')
const { allowedBugStatuses } = require('../services/bugRules')
const { allowedWorkOrderStatuses } = require('../services/workOrderStatusRules')
const { allowedPlanItemStatuses } = require('../services/projectStagePlanRules')
const { normalizeMcpQueryContent } = require('./contentPolicy')
const { createDownloadUrl } = require('../services/mcpFileDownloadService')
const { controllerSortField } = require('./sortFields')

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

const RESULT_ENUMS = {
  product: { status: { 0: '停用', 1: '启用' } },
  project: {
    status: { 0: '未开始', 1: '进行中', 2: '已完成', 3: '已暂停' },
    priority: { 0: '低', 1: '中', 2: '高' },
    is_overdue: { 0: '未逾期', 1: '已逾期' },
  },
  stage_plan: {
    status: { 0: '未开始', 1: '进行中', 2: '已完成', 3: '已暂停' },
    is_overdue: { 0: '未逾期', 1: '已逾期' },
    requires_delivery_file: { 0: '不要求', 1: '要求' },
  },
  requirement: {
    requirement_type: { 1: '上会立项', 2: '需求提报', 3: '预研', 4: '直接实施' },
    priority: { 0: '低', 1: '中', 2: '高' },
    status: {
      0: '上会评估', 1: '需求上会', 2: '上会通过', 3: '过会未通过',
      10: '提报评估', 11: '需求审批', 12: '审批通过', 13: '审批未通过',
      20: '需求验证', 21: '预研通过', 22: '预研不通过',
      30: '需求整理', 31: '实施中', 32: '试运行', 33: '已完成', 34: '已完成未使用', 35: '暂停',
    },
    is_overdue: { 0: '未逾期', 1: '已逾期' },
  },
  task: {
    source_type: { 1: '项目', 2: '需求' },
    priority: { 0: '低', 1: '中', 2: '高' },
    status: { 0: '待处理', 1: '处理中', 2: '已完成', 3: '已暂停' },
    is_overdue: { 0: '未逾期', 1: '已逾期' },
  },
  bug: {
    source_type: { 1: '项目', 2: '需求' },
    severity: { 1: '低', 2: '中', 3: '高', 4: '致命' },
    status: { 0: '新建', 1: '已修复', 2: '已关闭', 3: '被激活' },
  },
  work_order: {
    urgency: { 0: '低', 1: '中', 2: '高' },
    status: { 0: '待处理', 1: '处理中', 2: '已解决', 4: '已暂停', 5: '被激活' },
    is_overdue: { 0: '未逾期', 1: '已逾期' },
  },
}

function resultDomain(toolName) {
  return Object.keys(RESULT_ENUMS).find((prefix) => toolName.startsWith(`${prefix}_`))
}

function decorateObject(value, mappings) {
  if (Array.isArray(value)) return value.map((item) => decorateObject(item, mappings))
  if (!value || typeof value !== 'object') return value
  const decorated = {}
  for (const [field, item] of Object.entries(value)) {
    decorated[field] = decorateObject(item, mappings)
    const label = mappings[field]?.[String(item)]
    if (label !== undefined) decorated[`${field}_label`] = label
  }
  return decorated
}

function decorateQueryResult(toolName, value) {
  const domain = resultDomain(toolName)
  const decorated = domain ? decorateObject(value, RESULT_ENUMS[domain]) : value
  if (!decorated || typeof decorated !== 'object') return decorated
  if (toolName.endsWith('_get') && !Array.isArray(decorated)) {
    const allowed = allowedStatusesForRecord(domain, decorated)
    if (allowed) decorated.allowed_statuses = allowed
  }
  if (toolName === 'stage_plan_get') {
    for (const stage of decorated.stages || []) {
      for (const item of stage.items || []) {
        item.allowed_statuses = statusOptions(
          'stage_plan',
          allowedPlanItemStatuses(item.status, item.previous_status)
        )
      }
    }
  }
  return decorated
}

function statusOptions(domain, values) {
  const mapping = RESULT_ENUMS[domain]?.status || {}
  return values.map((value) => ({ value, label: mapping[String(value)] || String(value) }))
}

function allowedStatusesForRecord(domain, record) {
  const status = Number(record.status)
  if (!Number.isInteger(status)) return null
  if (domain === 'product') return statusOptions(domain, [status === 1 ? 0 : 1])
  if (domain === 'project') return statusOptions(domain, allowedProjectStatuses(status))
  if (domain === 'requirement') {
    return statusOptions(domain, allowedRequirementStatuses(record.requirement_type, status, record.previous_status))
  }
  if (domain === 'task') return statusOptions(domain, allowedTaskStatuses(status, record.previous_status))
  if (domain === 'bug') return statusOptions(domain, allowedBugStatuses(status))
  if (domain === 'work_order') return statusOptions(domain, allowedWorkOrderStatuses(status))
  return null
}

const handlers = {
  product_search: [product.list, (a) => ({ query: normalizeQuery(a, 'product_search') })],
  product_get: [product.getById, (a) => ({ params: { id: requireId(a) } })],
  product_history: [product.history, (a) => ({ params: { id: requireId(a) } })],
  project_search: [project.list, buildProjectSearchInput],
  project_get: [project.getById, (a) => ({ params: { id: requireId(a) } })],
  project_history: [project.history, (a) => ({ params: { id: requireId(a) } })],
  stage_plan_get: [stagePlan.getPlan, (a) => ({ params: { projectId: requireProjectId(a) } })],
  stage_plan_history: [stagePlan.history, (a) => ({ params: { projectId: requireProjectId(a) } })],
  contract_get: [contract.getByProject, (a) => ({ params: { id: requireProjectId(a) } })],
  requirement_search: [requirement.list, (a) => ({ query: normalizeQuery(a, 'requirement_search') })],
  requirement_get: [requirement.getById, (a) => ({ params: { id: requireId(a) } })],
  requirement_history: [requirement.history, (a) => ({ params: { id: requireId(a) } })],
  task_search: [task.list, buildTaskSearchInput],
  task_get: [task.getById, (a) => ({ params: { id: requireId(a) } })],
  task_history: [task.history, (a) => ({ params: { id: requireId(a) } })],
  bug_search: [bug.list, (a) => ({ query: normalizeQuery(a, 'bug_search') })],
  bug_get: [bug.getById, (a) => ({ params: { id: requireId(a) } })],
  bug_history: [bug.history, (a) => ({ params: { id: requireId(a) } })],
  work_order_search: [workOrder.list, (a) => ({ query: normalizeQuery(a, 'work_order_search') })],
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

const BUSINESS_OPTION_ARCHIVE_TYPES = {
  task_type: '任务类型',
  bug_type: 'Bug类型',
  bug_resolution: 'Bug解决方案',
  work_order_problem_type: '问题类型',
  supplier: '供应商',
}

function optionTypeError(optionType) {
  const message = `不支持的业务选项类型：${optionType}`
  const error = new Error(message)
  error.code = 'MCP_ARGUMENT_INVALID'
  error.fieldErrors = { option_type: message }
  return error
}

async function searchBusinessOptions(args = {}, database = db) {
  const optionType = String(args.option_type || '')
  if (optionType !== 'user' && !BUSINESS_OPTION_ARCHIVE_TYPES[optionType]) {
    throw optionTypeError(optionType)
  }
  const { page, pageSize, offset } = normalizePage(args)
  const keyword = String(args.keyword || '').trim()
  const params = []
  let from
  let where
  if (optionType === 'user') {
    from = 'FROM pms_user u'
    where = ['u.status = 1', 'u.is_deleted = 0']
    if (keyword) {
      where.push('u.real_name ILIKE ?')
      params.push(`%${keyword}%`)
    }
  } else {
    from = 'FROM pms_archive a JOIN pms_archive_type t ON t.id = a.archive_type_id'
    where = ['a.status = 1', 'a.is_deleted = 0', 't.status = 1', 't.is_deleted = 0', 't.name = ?']
    params.push(BUSINESS_OPTION_ARCHIVE_TYPES[optionType])
    if (keyword) {
      where.push('a.name ILIKE ?')
      params.push(`%${keyword}%`)
    }
  }
  const clause = ` WHERE ${where.join(' AND ')}`
  const count = await database.prepare(`SELECT COUNT(*)::INTEGER total ${from}${clause}`).get(...params)
  const alias = optionType === 'user' ? 'u' : 'a'
  const displayExpression = optionType === 'user'
    ? "u.real_name || '（用户ID ' || u.id || '）'"
    : 'a.name'
  const rows = await database.prepare(
    `SELECT ${alias}.id, ${alias}.${optionType === 'user' ? 'real_name' : 'name'} name,
      ${displayExpression} display_name
      ${from}${clause} ORDER BY name ASC, ${alias}.id ASC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset)
  const items = rows.map(({ display_name: displayName, ...item }) => ({
    ...item,
    displayName: displayName || item.name,
  }))
  return {
    optionType,
    items,
    total: Number(count?.total || 0),
    page,
    pageSize,
  }
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

function normalizeSearchResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  if (!Array.isArray(value.list) && !Array.isArray(value.items)) return value
  const { list, items, ...rest } = value
  const normalizedItems = items || list || []
  const total = Number(rest.total || 0)
  const page = Math.max(1, Number(rest.page) || 1)
  const pageSize = Math.max(1, Number(rest.pageSize) || normalizedItems.length || 20)
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0
  return {
    items: normalizedItems,
    ...rest,
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
  }
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

function attachmentResourceUri(row) {
  if (row.attachment_type === 'stage_delivery') {
    return `pmis://projects/${row.project_id}/stage-plan/items/${row.business_id}/files/${row.file_id}`
  }
  if (row.attachment_type === 'project_contract') {
    return `pmis://projects/${row.project_id}/contract/attachments/${row.file_id}`
  }
  return `pmis://products/${row.product_id}/maintenance-contracts/${row.business_id}/attachments/${row.file_id}`
}

function businessAttachmentBranches(context) {
  const branches = []
  if (context.allowedMenuPaths.has('/projects')) {
    branches.push(`SELECT 'stage_delivery' attachment_type, f.id file_id, f.original_name file_name,
      f.mime_type, f.size_bytes file_size, f.created_at, uploader.real_name uploader_name,
      p.id project_id, NULL::BIGINT product_id, i.id business_id, i.name business_name, p.name parent_name
      FROM pms_project_plan_delivery_file f
      JOIN pms_project_plan_item i ON i.id = f.plan_item_id AND i.is_deleted = 0
      JOIN pms_project_plan_stage s ON s.id = i.stage_id AND s.is_deleted = 0
      JOIN pms_project p ON p.id = s.project_id AND p.is_deleted = 0
      LEFT JOIN pms_user uploader ON uploader.id = f.uploader_id
      WHERE f.is_current = 1 AND f.is_void = 0 AND f.oss_response IS NOT NULL`)
    branches.push(`SELECT 'project_contract' attachment_type, a.id file_id, a.original_name file_name,
      a.mime_type, a.file_size, a.created_at, creator.real_name uploader_name,
      p.id project_id, NULL::BIGINT product_id, c.id business_id, c.contract_name business_name, p.name parent_name
      FROM pms_project_contract_attachment a
      JOIN pms_project_contract c ON c.id = a.contract_id AND c.is_deleted = 0
      JOIN pms_project p ON p.id = c.project_id AND p.is_deleted = 0
      LEFT JOIN pms_user creator ON creator.id = a.creator_id
      WHERE a.is_deleted = 0 AND a.oss_response IS NOT NULL`)
  }
  if (context.allowedMenuPaths.has('/products')) {
    branches.push(`SELECT 'product_maintenance_contract' attachment_type, a.id file_id, a.original_name file_name,
      a.mime_type, a.file_size, a.created_at, creator.real_name uploader_name,
      NULL::BIGINT project_id, p.id product_id, c.id business_id, c.contract_name business_name, p.name parent_name
      FROM pms_product_maintenance_contract_attachment a
      JOIN pms_product_maintenance_contract c ON c.id = a.contract_id AND c.is_deleted = 0
      JOIN pms_product p ON p.id = c.product_id AND p.is_deleted = 0
      LEFT JOIN pms_user creator ON creator.id = a.creator_id
      WHERE a.is_deleted = 0 AND a.oss_response IS NOT NULL`)
  }
  return branches
}

async function searchBusinessAttachments(args = {}, context, database = db, dependencies = {}) {
  const branches = businessAttachmentBranches(context)
  const { page, pageSize, offset } = normalizePage(args)
  if (!branches.length) return { items: [], total: 0, page, pageSize }
  const where = []
  const params = []
  const keyword = String(args.keyword || '').trim()
  if (keyword) {
    where.push('(file_name ILIKE ? OR business_name ILIKE ? OR parent_name ILIKE ?)')
    params.push(...Array(3).fill(`%${keyword}%`))
  }
  if (args.attachment_type) { where.push('attachment_type = ?'); params.push(args.attachment_type) }
  for (const [field, column] of [
    ['project_id', 'project_id'], ['product_id', 'product_id'], ['business_id', 'business_id'],
  ]) {
    const id = positiveId(args[field])
    if (id) { where.push(`${column} = ?`); params.push(id) }
  }
  const from = `FROM (${branches.join('\nUNION ALL\n')}) business_attachment`
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : ''
  const count = await database.prepare(`SELECT COUNT(*)::INTEGER total ${from}${clause}`).get(...params)
  const rows = await database.prepare(`SELECT * ${from}${clause} ORDER BY created_at DESC, file_id DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset)
  const makeDownloadUrl = dependencies.createDownloadUrl || createDownloadUrl
  return {
    items: rows.map((row) => {
      const resourceUri = attachmentResourceUri(row)
      return {
        ...row,
        resource_uri: resourceUri,
        download_url: makeDownloadUrl(resourceUri, context.user.id),
        delivery_mode: 'temporary_url',
      }
    }),
    total: Number(count?.total || 0),
    page,
    pageSize,
  }
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

function normalizeQuery(args, toolName) {
  const query = { ...args }
  if (query.sort_field !== undefined) query.sort_field = controllerSortField(toolName, query.sort_field)
  if (query.page_size !== undefined) {
    query.pageSize = Math.min(100, Math.max(1, Number(query.page_size) || 20))
    delete query.page_size
  }
  return query
}

function buildProjectSearchInput(args, context) {
  const query = normalizeQuery(args, 'project_search')
  delete query.view
  query.current_user_id = context.user.id
  if (args.view === 'mine') query.owner_id = context.user.id
  if (args.view === 'joined') query.joined_user_id = context.user.id
  return { query }
}

function buildTaskSearchInput(args) {
  return {
    query: {
      ...normalizeQuery(args, 'task_search'),
      mcp_flat: '1',
    },
  }
}

function unwrapEnvelope(envelope) {
  if (!envelope || typeof envelope.code !== 'number') return envelope
  if (envelope.code !== 0) {
    const error = new Error(envelope.message || '业务查询失败')
    error.code = envelope.code === 400
      ? 'MCP_BUSINESS_VALIDATION'
      : envelope.code === 403
        ? 'MCP_PERMISSION_DENIED'
        : envelope.code === 404
          ? 'MCP_NOT_FOUND'
          : envelope.code === 409
            ? 'MCP_CONFLICT'
            : 'MCP_BUSINESS_ERROR'
    error.fieldErrors = envelope.fieldErrors
    throw error
  }
  return envelope.data
}

async function dispatchQueryTool(name, args, context, dependencies = {}) {
  if (name === 'business_analyze') {
    return decorateQueryResult(`${args.domain}_analyze`, await analyzeBusinessData(args, dependencies.database))
  }
  if (name === 'global_search') {
    const runTool = dependencies.runTool || ((toolName, toolArgs) => dispatchQueryTool(toolName, toolArgs, context, dependencies))
    const entries = await Promise.all(buildGlobalSearchPlan(args, context).map(async ({ name: toolName, args: toolArgs }) => [
      toolName,
      normalizeMcpQueryContent(await runTool(toolName, toolArgs), { summary: true }),
    ]))
    return {
      keyword: String(args.keyword || '').trim() || null,
      results: Object.fromEntries(entries),
    }
  }
  if (name === 'business_attachment_search') {
    return normalizeMcpQueryContent(normalizeSearchResult(
      await searchBusinessAttachments(args, context, dependencies.database, dependencies)
    ), { summary: true })
  }
  if (name === 'stage_plan_search') return normalizeMcpQueryContent(decorateQueryResult(name, normalizeSearchResult(await searchStagePlans(args, dependencies.database))), { summary: true })
  if (name === 'contract_search') return normalizeMcpQueryContent(decorateQueryResult(name, normalizeSearchResult(await searchContracts(args, dependencies.database))), { summary: true })
  if (name === 'payment_search') return normalizeMcpQueryContent(decorateQueryResult(name, normalizeSearchResult(await searchPayments(args, dependencies.database))), { summary: true })
  if (name === 'business_options') return searchBusinessOptions(args, dependencies.database)
  const definition = handlers[name]
  if (!definition) throw new Error('查询工具不存在或无权限')
  const [handler, buildInput] = definition
  const value = unwrapEnvelope(await invokeController(handler, context, buildInput(args, context)))
  return normalizeMcpQueryContent(
    decorateQueryResult(name, name.endsWith('_search') ? normalizeSearchResult(value) : value),
    { summary: name.endsWith('_search') || name.endsWith('_history') }
  )
}

module.exports = {
  buildGlobalSearchPlan,
  buildProjectSearchInput,
  buildTaskSearchInput,
  decorateQueryResult,
  dispatchQueryTool,
  normalizeSearchResult,
  normalizeQuery,
  searchBusinessAttachments,
  searchBusinessOptions,
  searchContracts,
  searchPayments,
  searchStagePlans,
  unwrapEnvelope,
}
