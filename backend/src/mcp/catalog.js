const QUERY_TOOLS = [
  ['global_search', null],
  ['product_search', '/products'], ['product_get', '/products'], ['product_history', '/products'],
  ['project_search', '/projects'], ['project_get', '/projects'], ['project_history', '/projects'],
  ['stage_plan_search', '/projects'], ['stage_plan_get', '/projects'], ['stage_plan_history', '/projects'],
  ['contract_search', '/projects'], ['contract_get', '/projects'], ['payment_search', '/projects'],
  ['requirement_search', '/requirements'], ['requirement_get', '/requirements'], ['requirement_history', '/requirements'],
  ['task_search', '/tasks'], ['task_get', '/tasks'], ['task_history', '/tasks'],
  ['bug_search', '/bugs'], ['bug_get', '/bugs'], ['bug_history', '/bugs'],
  ['work_order_search', '/work-orders'], ['work_order_get', '/work-orders'], ['work_order_history', '/work-orders'],
  ['business_analyze', null],
]

const ACTION_TOOLS = [
  ['product_create', '/products'], ['product_update', '/products'], ['product_change_status', '/products'], ['product_delete', '/products'],
  ['project_create', '/projects'], ['project_update', '/projects'], ['project_change_status', '/projects'], ['project_delete', '/projects'],
  ['stage_create', '/projects'], ['stage_update', '/projects'], ['stage_reorder', '/projects'], ['stage_delete', '/projects'],
  ['stage_item_create', '/projects'], ['stage_item_batch_create', '/projects'], ['stage_item_update', '/projects'],
  ['stage_item_reorder', '/projects'], ['stage_item_change_status', '/projects'], ['stage_item_adjust', '/projects'], ['stage_item_delete', '/projects'],
  ['contract_create', '/projects'], ['contract_update', '/projects'], ['contract_delete', '/projects'],
  ['payment_create', '/projects'], ['payment_update', '/projects'], ['payment_delete', '/projects'],
  ['requirement_create', '/requirements'], ['requirement_update', '/requirements'], ['requirement_change_status', '/requirements'], ['requirement_delete', '/requirements'],
  ['task_create', '/tasks'], ['task_create_subtask', '/tasks'], ['task_update', '/tasks'], ['task_assign', '/tasks'], ['task_change_status', '/tasks'], ['task_delete', '/tasks'],
  ['bug_create', '/bugs'], ['bug_update', '/bugs'], ['bug_assign', '/bugs'], ['bug_change_status', '/bugs'], ['bug_delete', '/bugs'],
  ['work_order_create', '/work-orders'], ['work_order_update', '/work-orders'], ['work_order_assign', '/work-orders'], ['work_order_change_status', '/work-orders'], ['work_order_delete', '/work-orders'],
  ['contract_attachment_upload', '/projects'], ['contract_attachment_delete', '/projects'],
  ['stage_delivery_upload', '/projects'], ['stage_delivery_delete', '/projects'],
]
const SOURCE_TARGET_ACTIONS = new Set(['task_create', 'task_update', 'bug_create', 'bug_update'])

const stringField = { type: 'string' }
const nullableStringField = { type: ['string', 'null'] }
const idField = { type: ['integer', 'string', 'null'] }
const arrayIdField = { type: ['integer', 'string'] }
const numberField = { type: ['number', 'string', 'null'] }
const scalarField = { type: ['string', 'number', 'integer', 'boolean', 'null'] }
const idArrayField = { type: 'array', items: arrayIdField, minItems: 1, maxItems: 500 }
const optionalIdArrayField = { type: 'array', items: arrayIdField, minItems: 0, maxItems: 500 }
const controlProperties = {
  mode: { type: 'string', enum: ['preview', 'execute'] },
  confirmation_id: { type: 'string', format: 'uuid' },
  idempotency_key: { type: 'string', maxLength: 100 },
}

function fields(names, overrides = {}) {
  return Object.fromEntries(names.map((name) => [name, overrides[name] || scalarField]))
}

const querySchemas = {
  global_search: fields(['keyword', 'page_size']),
  product_search: fields(['name', 'owner_ids', 'status', 'sort_field', 'sort_order', 'page', 'page_size']),
  project_search: fields(['name', 'product_id', 'owner_id', 'member_ids', 'status', 'is_overdue', 'expected_end_date_from', 'expected_end_date_to', 'view', 'filter_owner_id', 'sort_field', 'sort_order', 'page', 'page_size']),
  stage_plan_search: fields(['keyword', 'project_id', 'owner_id', 'status', 'is_overdue', 'sort_field', 'sort_order', 'page', 'page_size']),
  contract_search: fields(['keyword', 'project_id', 'supplier_id', 'signed_date_from', 'signed_date_to', 'sort_field', 'sort_order', 'page', 'page_size']),
  payment_search: fields(['keyword', 'project_id', 'stage_id', 'handler_id', 'payment_month_from', 'payment_month_to', 'sort_field', 'sort_order', 'page', 'page_size']),
  requirement_search: fields(['title', 'product_id', 'project_id', 'owner_id', 'requirement_type', 'priority', 'status', 'is_overdue', 'submitter_name', 'submit_date_from', 'submit_date_to', 'expected_end_date_from', 'expected_end_date_to', 'view', 'filter_owner_id', 'sort_field', 'sort_order', 'page', 'page_size']),
  task_search: fields(['name', 'source_type', 'project_id', 'requirement_id', 'task_type', 'priority', 'status', 'is_overdue', 'owner_id', 'expected_end_date_from', 'expected_end_date_to', 'view', 'filter_owner_id', 'sort_field', 'sort_order', 'page', 'page_size']),
  bug_search: fields(['title', 'source_type', 'project_id', 'requirement_id', 'bug_type_id', 'severity', 'status', 'assignee_id', 'creator_id', 'created_at_from', 'created_at_to', 'view', 'filter_assignee_id', 'sort_field', 'sort_order', 'page', 'page_size']),
  work_order_search: fields(['problem_desc', 'product_id', 'problem_type', 'urgency', 'status', 'is_overdue', 'follower_id', 'submitter_name', 'submit_time_from', 'submit_time_to', 'expected_resolve_date_from', 'expected_resolve_date_to', 'sort_field', 'sort_order', 'page', 'page_size']),
  business_analyze: {
    domain: { type: 'string', enum: ['product', 'project', 'requirement', 'task', 'bug', 'work_order', 'contract', 'payment'] },
    metric: { type: 'string', enum: ['count', 'overdue_count', 'amount_sum', 'status_distribution'] },
    date_from: stringField,
    date_to: stringField,
    status: scalarField,
  },
}

const getByIdTools = new Set([
  'product_get', 'product_history', 'project_get', 'project_history',
  'requirement_get', 'requirement_history', 'task_get', 'task_history',
  'bug_get', 'bug_history', 'work_order_get', 'work_order_history',
])
const projectIdTools = new Set(['stage_plan_get', 'stage_plan_history', 'contract_get'])

const actionFieldNames = {
  product: ['id', 'name', 'description', 'owner_id', 'status'],
  project: ['id', 'name', 'description', 'product_id', 'owner_id', 'member_ids', 'start_date', 'expected_end_date', 'progress_text', 'risk_text', 'status', 'actual_end_date', 'suspend_date'],
  requirement: ['id', 'title', 'description', 'requirement_type', 'product_id', 'project_id', 'owner_id', 'priority', 'status', 'submitter_name', 'submitter_dept', 'submit_date', 'start_date', 'expected_end_date', 'actual_end_date', 'completion_status', 'pause_date'],
  task: ['id', 'parent_id', 'name', 'description', 'source_type', 'project_id', 'requirement_id', 'task_type', 'priority', 'owner_ids', 'status', 'start_date', 'expected_end_date', 'actual_end_date', 'suspend_date', 'ids'],
  bug: ['id', 'title', 'description', 'source_type', 'project_id', 'requirement_id', 'bug_type_id', 'severity', 'assignee_id', 'status', 'resolution_id', 'resolved_date', 'closed_date', 'activation_reason', 'ids'],
  work_order: ['id', 'product_id', 'problem_type', 'problem_desc', 'result_desc', 'follower_id', 'urgency', 'status', 'expected_resolve_date', 'resolve_date', 'close_date', 'suspend_date', 'activation_reason', 'submitter_name', 'submitter_dept', 'submit_time', 'ids'],
  stage: ['project_id', 'stage_id', 'item_id', 'name', 'description', 'ids', 'moved_id', 'owner_id', 'collaborator_ids', 'original_due_date', 'requires_delivery_file', 'remark', 'items', 'status', 'pause_reason', 'actual_end_date', 'new_due_date', 'reason'],
  contract: ['project_id', 'contract_code', 'contract_name', 'supplier_id', 'supplier_name', 'signed_date', 'contract_amount', 'remark', 'stages'],
  payment: ['project_id', 'stage_id', 'payment_id', 'payment_amount', 'payment_month', 'handler_id', 'remark'],
  file: ['project_id', 'item_id', 'attachment_id', 'file_id', 'file_name', 'mime_type', 'content_base64'],
}

const actionRequired = {
  product_create: ['name', 'owner_id', 'idempotency_key'],
  product_update: ['id', 'name', 'owner_id'], product_change_status: ['id', 'status'], product_delete: ['id'],
  project_create: ['name', 'product_id', 'owner_id', 'expected_end_date', 'idempotency_key'],
  project_update: ['id', 'name', 'product_id', 'owner_id', 'expected_end_date'],
  project_change_status: ['id', 'status'], project_delete: ['id'],
  requirement_create: ['title', 'requirement_type', 'product_id', 'owner_id', 'submitter_name', 'submit_date', 'idempotency_key'],
  requirement_update: ['id', 'title', 'requirement_type', 'product_id', 'owner_id', 'submitter_name', 'submit_date'],
  requirement_change_status: ['id', 'status'], requirement_delete: ['id'],
  task_create: ['name', 'source_type', 'task_type', 'owner_ids', 'priority', 'expected_end_date', 'idempotency_key'],
  task_create_subtask: ['parent_id', 'name', 'task_type', 'owner_ids', 'priority', 'expected_end_date', 'idempotency_key'],
  task_update: ['id', 'name', 'source_type', 'task_type', 'owner_ids'], task_assign: ['ids', 'owner_ids'],
  task_change_status: ['id', 'status'], task_delete: ['id'],
  bug_create: ['title', 'source_type', 'bug_type_id', 'severity', 'assignee_id', 'idempotency_key'],
  bug_update: ['id', 'title', 'source_type', 'bug_type_id', 'severity', 'assignee_id'],
  bug_assign: ['ids', 'assignee_id'], bug_change_status: ['id', 'status'], bug_delete: ['id'],
  work_order_create: ['product_id', 'problem_type', 'problem_desc', 'follower_id', 'urgency', 'expected_resolve_date', 'submitter_name', 'submitter_dept', 'submit_time', 'idempotency_key'],
  work_order_update: ['id', 'product_id', 'problem_type', 'problem_desc', 'follower_id', 'urgency', 'expected_resolve_date', 'submitter_name', 'submitter_dept', 'submit_time'],
  work_order_assign: ['ids', 'follower_id'], work_order_change_status: ['id', 'status'], work_order_delete: ['id'],
  stage_create: ['project_id', 'name', 'idempotency_key'], stage_update: ['project_id', 'stage_id', 'name'],
  stage_reorder: ['project_id', 'ids'], stage_delete: ['project_id', 'stage_id'],
  stage_item_create: ['project_id', 'stage_id', 'name', 'owner_id', 'original_due_date', 'idempotency_key'],
  stage_item_batch_create: ['project_id', 'stage_id', 'items', 'idempotency_key'],
  stage_item_update: ['project_id', 'item_id', 'stage_id', 'name', 'owner_id'],
  stage_item_reorder: ['project_id', 'stage_id', 'ids'],
  stage_item_change_status: ['project_id', 'item_id', 'status'],
  stage_item_adjust: ['project_id', 'item_id', 'new_due_date', 'reason'],
  stage_item_delete: ['project_id', 'item_id'],
  contract_create: ['project_id', 'contract_code', 'contract_name', 'supplier_id', 'signed_date', 'contract_amount', 'stages', 'idempotency_key'],
  contract_update: ['project_id', 'contract_code', 'contract_name', 'supplier_id', 'signed_date', 'contract_amount', 'stages'],
  contract_delete: ['project_id'],
  payment_create: ['project_id', 'stage_id', 'payment_amount', 'payment_month', 'handler_id', 'idempotency_key'],
  payment_update: ['project_id', 'payment_id', 'payment_amount', 'payment_month', 'handler_id'],
  payment_delete: ['project_id', 'payment_id'],
  contract_attachment_upload: ['project_id', 'file_name', 'content_base64', 'idempotency_key'],
  contract_attachment_delete: ['project_id', 'attachment_id'],
  stage_delivery_upload: ['project_id', 'item_id', 'file_name', 'content_base64', 'idempotency_key'],
  stage_delivery_delete: ['project_id', 'item_id', 'file_id'],
}

const statusActionSchemas = {
  product_change_status: {
    type: 'integer',
    enum: [0, 1],
    description: '目标状态：0 停用，1 启用',
  },
  project_change_status: {
    type: 'integer',
    enum: [0, 1, 2, 3],
    description: '目标状态：0 未开始，1 进行中，2 已完成，3 已暂停；完成需 actual_end_date，暂停需 suspend_date',
  },
  requirement_change_status: {
    type: 'integer',
    enum: [0, 1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 30, 31, 32, 33, 34, 35],
    description: '目标状态由需求路径和当前状态决定；33/34 需 actual_end_date、completion_status，35 需 pause_date',
  },
  task_change_status: {
    type: 'integer',
    enum: [0, 1, 2, 3],
    description: '目标状态：0 待处理，1 处理中，2 已完成，3 已暂停；完成需 actual_end_date，暂停需 suspend_date',
  },
  bug_change_status: {
    type: 'integer',
    enum: [0, 1, 2, 3],
    description: '目标状态：0 新建，1 已修复，2 已关闭，3 被激活；修复需 resolved_date、resolution_id，关闭需 closed_date，激活需 activation_reason',
  },
  work_order_change_status: {
    type: 'integer',
    enum: [0, 1, 2, 4, 5],
    description: '目标状态：0 待处理，1 处理中，2 已解决，4 已暂停，5 已激活；解决需 resolve_date、result_desc，暂停需 suspend_date，激活需 activation_reason',
  },
  stage_item_change_status: {
    type: 'integer',
    enum: [0, 1, 2, 3],
    description: '目标状态：0 未开始，1 进行中，2 已完成，3 已暂停；完成需 actual_end_date，暂停需 pause_reason；要求交付文件时须先调用 stage_delivery_upload',
  },
}

function actionGroup(name) {
  if (name.startsWith('stage_delivery_') || name.startsWith('contract_attachment_')) return 'file'
  return Object.keys(actionFieldNames).find((prefix) => name.startsWith(`${prefix}_`))
}

function queryInputSchema(name) {
  if (getByIdTools.has(name)) {
    return { type: 'object', properties: { id: idField }, required: ['id'], additionalProperties: false }
  }
  if (projectIdTools.has(name)) {
    return { type: 'object', properties: { project_id: idField }, required: ['project_id'], additionalProperties: false }
  }
  return {
    type: 'object',
    properties: querySchemas[name] || {},
    required: name === 'business_analyze' ? ['domain', 'metric'] : undefined,
    additionalProperties: false,
  }
}

function actionInputSchema(name) {
  const group = actionGroup(name)
  const properties = {
    ...controlProperties,
    ...fields(actionFieldNames[group] || []),
  }
  for (const key of ['owner_ids', 'ids']) if (key in properties) properties[key] = idArrayField
  for (const key of ['member_ids', 'collaborator_ids']) if (key in properties) properties[key] = optionalIdArrayField
  if ('items' in properties) properties.items = {
    type: 'array',
    minItems: 1,
    maxItems: 100,
    items: {
      type: 'object',
      properties: {
        name: stringField,
        owner_id: idField,
        collaborator_ids: optionalIdArrayField,
        original_due_date: stringField,
        requires_delivery_file: numberField,
        remark: stringField,
      },
      required: ['name', 'owner_id', 'original_due_date'],
      additionalProperties: false,
    },
  }
  if ('stages' in properties) properties.stages = {
    type: 'array',
    minItems: 1,
    maxItems: 100,
    items: {
      type: 'object',
      properties: {
        id: idField,
        stage_name: stringField,
        planned_amount: numberField,
      },
      required: ['stage_name', 'planned_amount'],
      additionalProperties: false,
    },
  }
  if ('content_base64' in properties) properties.content_base64 = { type: 'string', maxLength: 12 * 1024 * 1024 }
  for (const key of [
    'name', 'description', 'title', 'start_date', 'expected_end_date', 'actual_end_date', 'suspend_date',
    'progress_text', 'risk_text', 'submitter_name', 'submitter_dept', 'submit_date', 'pause_date',
    'completion_status', 'problem_desc', 'result_desc', 'expected_resolve_date', 'resolve_date', 'close_date',
    'resolved_date', 'closed_date',
    'activation_reason', 'submit_time', 'original_due_date', 'remark', 'pause_reason', 'new_due_date', 'reason',
    'contract_code', 'contract_name', 'supplier_name', 'signed_date', 'payment_month', 'file_name', 'mime_type',
  ]) {
    if (key in properties) properties[key] = nullableStringField
  }
  for (const key of ['status', 'requirement_type', 'priority', 'source_type', 'severity', 'urgency', 'requires_delivery_file']) {
    if (key in properties) properties[key] = numberField
  }
  for (const key of ['id', 'parent_id', 'project_id', 'stage_id', 'item_id', 'payment_id', 'attachment_id', 'file_id', 'owner_id', 'product_id', 'supplier_id', 'handler_id', 'assignee_id', 'follower_id', 'task_type', 'bug_type_id', 'resolution_id', 'moved_id']) {
    if (key in properties) properties[key] = idField
  }
  for (const key of ['contract_amount', 'payment_amount']) if (key in properties) properties[key] = numberField
  if (statusActionSchemas[name]) properties.status = statusActionSchemas[name]
  return { type: 'object', properties, required: actionRequired[name], additionalProperties: false }
}

function titleFromName(name) {
  return name.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')
}

const actionEntityLabels = {
  product: '产品',
  project: '项目',
  requirement: '需求',
  task: '任务',
  bug: 'BUG',
  work_order: '运维工单',
}

function actionTitle(name) {
  const type = Object.keys(actionEntityLabels).find((prefix) => name.startsWith(`${prefix}_`))
  if (type) {
    const entity = actionEntityLabels[type]
    const operation = name.slice(type.length + 1)
    if (operation === 'create') return `新增${entity}`
    if (operation === 'create_subtask') return '新增子任务'
    if (operation === 'update') return `编辑${entity}`
    if (operation === 'assign') return `批量指派${entity}`
    if (operation === 'change_status') return `变更${entity}状态`
    if (operation === 'delete') return `删除${entity}`
  }
  const special = {
    stage_create: '新增项目阶段',
    stage_update: '编辑项目阶段',
    stage_reorder: '调整项目阶段顺序',
    stage_delete: '删除项目阶段',
    stage_item_create: '新增关键事项',
    stage_item_batch_create: '批量新增关键事项',
    stage_item_update: '编辑关键事项',
    stage_item_reorder: '调整关键事项顺序',
    stage_item_change_status: '变更关键事项状态',
    stage_item_adjust: '调整关键事项计划',
    stage_item_delete: '删除关键事项',
    contract_create: '新增项目合同',
    contract_update: '编辑项目合同',
    contract_delete: '删除项目合同',
    payment_create: '登记付款',
    payment_update: '更正付款',
    payment_delete: '删除付款',
    contract_attachment_upload: '上传合同附件',
    contract_attachment_delete: '删除合同附件',
    stage_delivery_upload: '上传关键事项交付文件',
    stage_delivery_delete: '删除关键事项交付文件',
  }
  return special[name] || titleFromName(name)
}

const queryDescriptions = {
  global_search: '全局搜索当前员工有权限的全部PMIS业务模块；可不传任何参数，默认返回各模块前20条有效数据',
  stage_plan_search: '全局搜索所有项目的阶段主计划事项；可不传任何参数',
  contract_search: '全局搜索所有项目合同；可不传任何参数',
  payment_search: '全局搜索所有项目付款记录；可不传任何参数',
}

function baseDefinition([name, menuPath], endpointType) {
  return {
    name,
    title: endpointType === 'action' ? actionTitle(name) : titleFromName(name),
    description: endpointType === 'query'
      ? queryDescriptions[name] || `查询PMIS业务数据：${name}；搜索工具可不传任何参数`
      : `${actionTitle(name)}。必须先使用 preview 获取当前目标、风险和一次性确认号；仅在用户确认后，才使用完全相同的业务参数和确认号执行 execute。`,
    inputSchema: endpointType === 'query' ? queryInputSchema(name) : actionInputSchema(name),
    annotations: endpointType === 'query'
      ? { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
      : { readOnlyHint: false, destructiveHint: name.endsWith('_delete'), idempotentHint: false },
    _meta: {
      endpointType,
      menuPath,
      requiresSourceTarget: endpointType === 'action' && SOURCE_TARGET_ACTIONS.has(name),
    },
  }
}

const toolCatalog = [
  ...QUERY_TOOLS.map((item) => baseDefinition(item, 'query')),
  ...ACTION_TOOLS.map((item) => baseDefinition(item, 'action')),
]

function filterToolsForContext(context) {
  return toolCatalog.filter((tool) => {
    if (tool._meta.endpointType !== context.endpointType) return false
    if (!tool._meta.menuPath) {
      return context.endpointType === 'query' && context.allowedMenuPaths.size > 0
    }
    return context.allowedMenuPaths.has(tool._meta.menuPath)
  }).map(({ _meta, ...tool }) => tool)
}

function getToolDefinition(name, endpointType) {
  return toolCatalog.find((tool) => tool.name === name && tool._meta.endpointType === endpointType)
}

module.exports = { filterToolsForContext, getToolDefinition, toolCatalog }
