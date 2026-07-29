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
  ['business_options', null],
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

const ENUMS = {
  binary: { values: [0, 1], text: '0=否，1=是' },
  enabled: { values: [0, 1], text: '0=停用，1=启用' },
  priority: { values: [0, 1, 2], text: '0=低，1=中，2=高' },
  sourceType: { values: [1, 2], text: '1=项目，2=需求' },
  requirementType: { values: [1, 2, 3, 4], text: '1=上会立项，2=需求提报，3=预研，4=直接实施' },
  commonStatus: { values: [0, 1, 2, 3], text: '0=未开始，1=进行中，2=已完成，3=已暂停' },
  taskStatus: { values: [0, 1, 2, 3], text: '0=待处理，1=处理中，2=已完成，3=已暂停' },
  bugStatus: { values: [0, 1, 2, 3], text: '0=新建，1=已修复，2=已关闭，3=被激活' },
  workOrderStatus: { values: [0, 1, 2, 4, 5], text: '0=待处理，1=处理中，2=已解决，4=已暂停，5=被激活' },
  requirementStatus: {
    values: [0, 1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 30, 31, 32, 33, 34, 35],
    text: '0=上会评估，1=需求上会，2=上会通过，3=过会未通过，10=提报评估，11=需求审批，12=审批通过，13=审批未通过，20=需求验证，21=预研通过，22=预研不通过，30=需求整理，31=实施中，32=试运行，33=已完成，34=已完成未使用，35=暂停',
  },
  severity: { values: [1, 2, 3, 4], text: '1=低，2=中，3=高，4=致命' },
  urgency: { values: [0, 1, 2], text: '0=低，1=中，2=高' },
}

const described = (schema, description) => ({ ...schema, description })
const enumField = (entry, label) => described({ type: 'integer', enum: entry.values }, `${label}：${entry.text}`)
const stringField = described({ type: 'string' }, '文本')
const nullableStringField = described({ type: ['string', 'null'] }, '文本；不填写时可为 null')
const idField = described({
  type: ['integer', 'string', 'null'],
  minimum: 1,
  pattern: '^[1-9]\\d*$',
}, '正整数业务记录标识；应先用查询工具定位，不要猜测')
const arrayIdField = described({
  type: ['integer', 'string'],
  minimum: 1,
  pattern: '^[1-9]\\d*$',
}, '正整数业务记录标识')
const scalarField = described({ type: ['string', 'number', 'integer', 'boolean', 'null'] }, '筛选值')
const idArrayField = described({ type: 'array', items: arrayIdField, minItems: 1, maxItems: 500 }, '业务记录标识列表，至少一项')
const optionalIdArrayField = described({ type: 'array', items: arrayIdField, minItems: 0, maxItems: 500 }, '业务记录标识列表；传空数组表示清空')
const controlProperties = {
  mode: described({ type: 'string', enum: ['preview', 'execute'] }, '操作模式：preview=仅预览，execute=确认后执行；默认 preview'),
  confirmation_id: described({ type: 'string', format: 'uuid' }, '预览返回的一次性确认号；execute 时必填'),
  idempotency_key: described({ type: 'string', maxLength: 100 }, '新增、上传或批量操作的幂等键；相同业务请求必须保持一致'),
}

const FIELD_DESCRIPTIONS = {
  keyword: '全局关键词；不填写时查询全部有权限数据',
  page: '页码，从 1 开始',
  page_size: '每页条数，1 至 100',
  sort_field: '排序字段；仅可使用工具说明中支持的字段',
  sort_order: '排序方向：asc=升序，desc=降序',
  view: '人员视角：mine=我负责的，joined=我参与的',
  status: '状态',
  is_overdue: '逾期筛选：0=未逾期，1=逾期',
  name: '名称',
  title: '标题',
  description: '详细描述',
  problem_desc: '问题描述',
  result_desc: '处理结果',
  owner_id: '负责人用户标识；先用 business_options(option_type=user) 定位',
  owner_ids: '负责人用户标识列表；先用 business_options(option_type=user) 定位，至少一人',
  member_ids: '项目成员用户标识列表；先用 business_options(option_type=user) 定位，传空数组表示清空',
  collaborator_ids: '协作人用户标识列表；先用 business_options(option_type=user) 定位，传空数组表示清空',
  assignee_id: '指派处理人用户标识；先用 business_options(option_type=user) 定位',
  follower_id: '跟进人用户标识；先用 business_options(option_type=user) 定位',
  handler_id: '经办人用户标识；先用 business_options(option_type=user) 定位',
  creator_id: '创建人用户标识；先用 business_options(option_type=user) 定位',
  product_id: '产品标识；新增或编辑业务单据时，必须先用 product_search(status=1) 选择启用产品',
  project_id: '项目标识；先用 project_search 定位',
  requirement_id: '需求标识；先用 requirement_search 定位',
  stage_id: '项目阶段标识；先用 stage_plan_search 或 business_get(domain=stage_plan) 定位',
  item_id: '阶段关键事项标识；先用 stage_plan_search 或 business_get(domain=stage_plan) 定位',
  payment_id: '付款记录标识；先用 payment_search 定位',
  supplier_id: '供应商档案标识；先用 business_options(option_type=supplier) 定位',
  problem_type: '工单问题类型档案标识；先用 business_options(option_type=work_order_problem_type) 定位',
  task_type: '任务类型档案标识；先用 business_options(option_type=task_type) 定位',
  bug_type_id: 'BUG类型档案标识；先用 business_options(option_type=bug_type) 定位',
  resolution_id: 'BUG解决方案档案标识；先用 business_options(option_type=bug_resolution) 定位',
  source_type: `关联类型：${ENUMS.sourceType.text}`,
  priority: `优先级：${ENUMS.priority.text}`,
  requirement_type: `需求类型：${ENUMS.requirementType.text}`,
  severity: `严重程度：${ENUMS.severity.text}`,
  urgency: `紧急程度：${ENUMS.urgency.text}`,
  requires_delivery_file: '是否要求交付文件：0=不要求，1=要求',
  expected_end_date: '预计完成日期，格式 YYYY-MM-DD',
  start_date: '计划开始日期，格式 YYYY-MM-DD',
  actual_end_date: '实际完成日期，格式 YYYY-MM-DD；完成状态时按规则必填',
  suspend_date: '暂停日期，格式 YYYY-MM-DD；暂停状态时必填',
  pause_date: '暂停日期，格式 YYYY-MM-DD；暂停状态时必填',
  resolved_date: '解决日期，格式 YYYY-MM-DD；BUG变为已修复时必填',
  closed_date: '关闭日期，格式 YYYY-MM-DD；BUG变为已关闭时必填',
  resolve_date: '解决日期，格式 YYYY-MM-DD；工单变为已解决时必填',
  original_due_date: '原计划完成日期，格式 YYYY-MM-DD',
  new_due_date: '调整后的完成日期，格式 YYYY-MM-DD',
  signed_date: '合同签订日期，格式 YYYY-MM-DD',
  submit_date: '提出日期，格式 YYYY-MM-DD',
  submit_time: '提出时间，格式 YYYY-MM-DD 或 ISO 8601 日期时间',
  payment_month: '付款月份，格式 YYYY-MM',
  contract_amount: '合同金额，必须大于 0',
  payment_amount: '付款金额，必须大于 0',
  ids: '待批量处理的业务记录标识列表',
  moved_id: '本次被移动的业务记录标识；必须包含在 ids 中',
  parent_id: '父任务标识；先用 task_search 定位',
  completion_status: '完成情况说明；需求完成时必填',
  activation_reason: '激活原因；恢复激活时必填',
  pause_reason: '暂停原因；关键事项暂停时必填',
  reason: '调整原因',
  id: '业务记录标识；先用对应查询工具定位，不要猜测',
}

function withDescription(name, schema) {
  return { ...schema, description: FIELD_DESCRIPTIONS[name] || schema.description || `${name} 参数` }
}

function fields(names, overrides = {}) {
  return Object.fromEntries(names.map((name) => [name, withDescription(name, overrides[name] || scalarField)]))
}

const querySchemas = {
  global_search: fields(['keyword', 'page_size']),
  product_search: fields(['name', 'owner_ids', 'status', 'sort_field', 'sort_order', 'page', 'page_size']),
  project_search: fields(['name', 'product_id', 'owner_id', 'member_ids', 'status', 'is_overdue', 'expected_end_date_from', 'expected_end_date_to', 'view', 'sort_field', 'sort_order', 'page', 'page_size']),
  stage_plan_search: fields(['keyword', 'project_id', 'owner_id', 'status', 'is_overdue', 'sort_field', 'sort_order', 'page', 'page_size']),
  contract_search: fields(['keyword', 'project_id', 'supplier_id', 'signed_date_from', 'signed_date_to', 'sort_field', 'sort_order', 'page', 'page_size']),
  payment_search: fields(['keyword', 'project_id', 'stage_id', 'handler_id', 'payment_month_from', 'payment_month_to', 'sort_field', 'sort_order', 'page', 'page_size']),
  requirement_search: fields(['title', 'product_id', 'project_id', 'owner_id', 'requirement_type', 'priority', 'status', 'is_overdue', 'submitter_name', 'submit_date_from', 'submit_date_to', 'expected_end_date_from', 'expected_end_date_to', 'view', 'sort_field', 'sort_order', 'page', 'page_size']),
  task_search: fields(['name', 'source_type', 'project_id', 'requirement_id', 'task_type', 'priority', 'status', 'is_overdue', 'owner_id', 'expected_end_date_from', 'expected_end_date_to', 'view', 'sort_field', 'sort_order', 'page', 'page_size']),
  bug_search: fields(['title', 'source_type', 'project_id', 'requirement_id', 'bug_type_id', 'severity', 'status', 'assignee_id', 'creator_id', 'created_at_from', 'created_at_to', 'view', 'sort_field', 'sort_order', 'page', 'page_size']),
  work_order_search: fields(['problem_desc', 'product_id', 'problem_type', 'urgency', 'status', 'is_overdue', 'follower_id', 'submitter_name', 'submit_time_from', 'submit_time_to', 'expected_resolve_date_from', 'expected_resolve_date_to', 'sort_field', 'sort_order', 'page', 'page_size']),
  business_options: {
    option_type: described({
      type: 'string',
      enum: ['user', 'task_type', 'bug_type', 'bug_resolution', 'work_order_problem_type', 'supplier'],
    }, '选项类型：user=有效用户，task_type=任务类型，bug_type=BUG类型，bug_resolution=BUG解决方案，work_order_problem_type=工单问题类型，supplier=供应商'),
    keyword: described({ type: 'string' }, '选项名称关键词；不填写时查询全部有效选项'),
    page: described({ type: 'integer', minimum: 1 }, FIELD_DESCRIPTIONS.page),
    page_size: described({ type: 'integer', minimum: 1, maximum: 100 }, FIELD_DESCRIPTIONS.page_size),
  },
  business_analyze: {
    domain: described({ type: 'string', enum: ['product', 'project', 'requirement', 'task', 'bug', 'work_order', 'contract', 'payment'] }, '统计业务领域'),
    metric: described({ type: 'string', enum: ['count', 'overdue_count', 'amount_sum', 'status_distribution'] }, '统计指标'),
    date_from: described({ type: 'string', format: 'date' }, '创建日期开始，格式 YYYY-MM-DD'),
    date_to: described({ type: 'string', format: 'date' }, '创建日期结束，格式 YYYY-MM-DD'),
    status: described({ type: 'integer' }, '业务状态；可选值由业务领域决定'),
  },
}

const SORT_FIELDS = {
  product_search: ['name', 'ownerName', 'description', 'status', 'creatorName', 'createdAt'],
  project_search: ['name', 'productName', 'ownerName', 'status', 'startDate', 'expectedEndDate', 'members', 'creatorName', 'createdAt'],
  requirement_search: ['title', 'requirementType', 'status', 'productName', 'projectName', 'ownerName', 'priority', 'submitterName', 'submitDate', 'expectedEndDate', 'creatorName', 'createdAt'],
  task_search: ['name', 'sourceName', 'ownerNames', 'taskTypeName', 'priority', 'status', 'expectedEndTime', 'createdAt'],
  bug_search: ['title', 'sourceName', 'assigneeName', 'bugTypeName', 'severity', 'status', 'creatorName', 'createdAt'],
  work_order_search: ['problem_desc', 'product_id', 'problem_type', 'urgency', 'status', 'is_overdue', 'follower_name', 'follower_id', 'submitter_name', 'submitter_dept', 'submit_time', 'expected_resolve_date', 'creator_name', 'created_at'],
  stage_plan_search: ['project_name', 'stage_name', 'item_name', 'status', 'current_due_date', 'created_at'],
  contract_search: ['project_name', 'contract_code', 'contract_name', 'signed_date', 'contract_amount', 'created_at'],
  payment_search: ['project_name', 'stage_name', 'payment_month', 'payment_amount', 'handler_name', 'created_at'],
}

const ANALYSIS_BRANCHES = {
  product: { label: '产品', metrics: ['count', 'status_distribution'], status: ENUMS.enabled },
  project: { label: '项目', metrics: ['count', 'overdue_count', 'status_distribution'], status: ENUMS.commonStatus },
  requirement: { label: '需求', metrics: ['count', 'overdue_count', 'status_distribution'], status: ENUMS.requirementStatus },
  task: { label: '任务', metrics: ['count', 'overdue_count', 'status_distribution'], status: ENUMS.taskStatus },
  bug: { label: 'BUG', metrics: ['count', 'status_distribution'], status: ENUMS.bugStatus },
  work_order: { label: '工单', metrics: ['count', 'overdue_count', 'status_distribution'], status: ENUMS.workOrderStatus },
  contract: { label: '合同', metrics: ['count', 'amount_sum'] },
  payment: { label: '付款', metrics: ['count', 'amount_sum'] },
}

const getByIdTools = new Set([
  'product_get', 'product_history', 'project_get', 'project_history',
  'requirement_get', 'requirement_history', 'task_get', 'task_history',
  'bug_get', 'bug_history', 'work_order_get', 'work_order_history',
])
const projectIdTools = new Set(['stage_plan_get', 'stage_plan_history', 'contract_get'])

const actionFields = {
  product_create: ['name', 'description', 'owner_id'],
  product_update: ['id', 'name', 'description', 'owner_id'],
  product_change_status: ['id', 'status'],
  product_delete: ['id'],
  project_create: ['name', 'description', 'product_id', 'owner_id', 'member_ids', 'start_date', 'expected_end_date', 'progress_text', 'risk_text'],
  project_update: ['id', 'name', 'description', 'product_id', 'owner_id', 'member_ids', 'start_date', 'expected_end_date', 'progress_text', 'risk_text'],
  project_change_status: ['id', 'status', 'actual_end_date', 'suspend_date'],
  project_delete: ['id'],
  requirement_create: ['title', 'description', 'requirement_type', 'product_id', 'project_id', 'owner_id', 'priority', 'submitter_name', 'submitter_dept', 'submit_date', 'start_date', 'expected_end_date'],
  requirement_update: ['id', 'title', 'description', 'requirement_type', 'product_id', 'project_id', 'owner_id', 'priority', 'submitter_name', 'submitter_dept', 'submit_date', 'start_date', 'expected_end_date'],
  requirement_change_status: ['id', 'status', 'actual_end_date', 'completion_status', 'pause_date'],
  requirement_delete: ['id'],
  task_create: ['name', 'description', 'source_type', 'project_id', 'requirement_id', 'task_type', 'priority', 'owner_ids', 'start_date', 'expected_end_date'],
  task_create_subtask: ['parent_id', 'name', 'description', 'task_type', 'priority', 'owner_ids', 'start_date', 'expected_end_date'],
  task_update: ['id', 'name', 'description', 'source_type', 'project_id', 'requirement_id', 'task_type', 'priority', 'owner_ids', 'start_date', 'expected_end_date'],
  task_assign: ['ids', 'owner_ids'],
  task_change_status: ['id', 'status', 'actual_end_date', 'suspend_date'],
  task_delete: ['id'],
  bug_create: ['title', 'description', 'source_type', 'project_id', 'requirement_id', 'bug_type_id', 'severity', 'assignee_id'],
  bug_update: ['id', 'title', 'description', 'source_type', 'project_id', 'requirement_id', 'bug_type_id', 'severity', 'assignee_id'],
  bug_assign: ['ids', 'assignee_id'],
  bug_change_status: ['id', 'status', 'resolution_id', 'resolved_date', 'closed_date', 'activation_reason'],
  bug_delete: ['id'],
  work_order_create: ['product_id', 'problem_type', 'problem_desc', 'result_desc', 'follower_id', 'urgency', 'expected_resolve_date', 'resolve_date', 'submitter_name', 'submitter_dept', 'submit_time'],
  work_order_update: ['id', 'product_id', 'problem_type', 'problem_desc', 'result_desc', 'follower_id', 'urgency', 'expected_resolve_date', 'resolve_date', 'submitter_name', 'submitter_dept', 'submit_time'],
  work_order_assign: ['ids', 'follower_id'],
  work_order_change_status: ['id', 'status', 'resolve_date', 'result_desc', 'suspend_date', 'activation_reason'],
  work_order_delete: ['id'],
  stage_create: ['project_id', 'name', 'description'],
  stage_update: ['project_id', 'stage_id', 'name', 'description'],
  stage_reorder: ['project_id', 'ids', 'moved_id'],
  stage_delete: ['project_id', 'stage_id'],
  stage_item_create: ['project_id', 'stage_id', 'name', 'owner_id', 'collaborator_ids', 'original_due_date', 'requires_delivery_file', 'remark'],
  stage_item_batch_create: ['project_id', 'stage_id', 'items'],
  stage_item_update: ['project_id', 'item_id', 'stage_id', 'name', 'owner_id', 'collaborator_ids', 'requires_delivery_file', 'remark'],
  stage_item_reorder: ['project_id', 'stage_id', 'ids', 'moved_id'],
  stage_item_change_status: ['project_id', 'item_id', 'status', 'actual_end_date', 'pause_reason'],
  stage_item_adjust: ['project_id', 'item_id', 'new_due_date', 'reason'],
  stage_item_delete: ['project_id', 'item_id'],
  contract_create: ['project_id', 'contract_code', 'contract_name', 'supplier_id', 'signed_date', 'contract_amount', 'remark', 'stages'],
  contract_update: ['project_id', 'contract_code', 'contract_name', 'supplier_id', 'signed_date', 'contract_amount', 'remark', 'stages'],
  contract_delete: ['project_id'],
  payment_create: ['project_id', 'stage_id', 'payment_amount', 'payment_month', 'handler_id', 'remark'],
  payment_update: ['project_id', 'payment_id', 'payment_amount', 'payment_month', 'handler_id', 'remark'],
  payment_delete: ['project_id', 'payment_id'],
  contract_attachment_upload: ['project_id', 'file_name', 'mime_type', 'content_base64'],
  contract_attachment_delete: ['project_id', 'attachment_id'],
  stage_delivery_upload: ['project_id', 'item_id', 'file_name', 'mime_type', 'content_base64'],
  stage_delivery_delete: ['project_id', 'item_id', 'file_id'],
}

const actionRequired = {
  product_create: ['name', 'owner_id', 'idempotency_key'],
  product_update: ['id'], product_change_status: ['id', 'status'], product_delete: ['id'],
  project_create: ['name', 'product_id', 'owner_id', 'expected_end_date', 'idempotency_key'],
  project_update: ['id'],
  project_change_status: ['id', 'status'], project_delete: ['id'],
  requirement_create: ['title', 'requirement_type', 'product_id', 'owner_id', 'submitter_name', 'submit_date', 'idempotency_key'],
  requirement_update: ['id'],
  requirement_change_status: ['id', 'status'], requirement_delete: ['id'],
  task_create: ['name', 'source_type', 'task_type', 'owner_ids', 'priority', 'expected_end_date', 'idempotency_key'],
  task_create_subtask: ['parent_id', 'name', 'task_type', 'owner_ids', 'priority', 'expected_end_date', 'idempotency_key'],
  task_update: ['id'], task_assign: ['ids', 'owner_ids'],
  task_change_status: ['id', 'status'], task_delete: ['id'],
  bug_create: ['title', 'source_type', 'bug_type_id', 'severity', 'assignee_id', 'idempotency_key'],
  bug_update: ['id'],
  bug_assign: ['ids', 'assignee_id'], bug_change_status: ['id', 'status'], bug_delete: ['id'],
  work_order_create: ['product_id', 'problem_type', 'problem_desc', 'follower_id', 'urgency', 'expected_resolve_date', 'submitter_name', 'submitter_dept', 'submit_time', 'idempotency_key'],
  work_order_update: ['id'],
  work_order_assign: ['ids', 'follower_id'], work_order_change_status: ['id', 'status'], work_order_delete: ['id'],
  stage_create: ['project_id', 'name', 'idempotency_key'], stage_update: ['project_id', 'stage_id'],
  stage_reorder: ['project_id', 'ids', 'moved_id'], stage_delete: ['project_id', 'stage_id'],
  stage_item_create: ['project_id', 'stage_id', 'name', 'owner_id', 'original_due_date', 'idempotency_key'],
  stage_item_batch_create: ['project_id', 'stage_id', 'items', 'idempotency_key'],
  stage_item_update: ['project_id', 'item_id'],
  stage_item_reorder: ['project_id', 'stage_id', 'ids', 'moved_id'],
  stage_item_change_status: ['project_id', 'item_id', 'status'],
  stage_item_adjust: ['project_id', 'item_id', 'new_due_date', 'reason'],
  stage_item_delete: ['project_id', 'item_id'],
  contract_create: ['project_id', 'contract_code', 'contract_name', 'supplier_id', 'signed_date', 'contract_amount', 'stages', 'idempotency_key'],
  contract_update: ['project_id'],
  contract_delete: ['project_id'],
  payment_create: ['project_id', 'stage_id', 'payment_amount', 'payment_month', 'handler_id', 'idempotency_key'],
  payment_update: ['project_id', 'payment_id'],
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

function queryInputSchema(name) {
  if (getByIdTools.has(name)) {
    return { type: 'object', properties: { id: withDescription('id', idField) }, required: ['id'], additionalProperties: false }
  }
  if (projectIdTools.has(name)) {
    return { type: 'object', properties: { project_id: withDescription('project_id', idField) }, required: ['project_id'], additionalProperties: false }
  }
  const properties = { ...(querySchemas[name] || {}) }
  for (const [field, schema] of Object.entries(properties)) properties[field] = queryFieldSchema(name, field, schema)
  const schema = {
    type: 'object',
    properties,
    required: name === 'business_analyze'
      ? ['domain', 'metric']
      : name === 'business_options'
        ? ['option_type']
        : undefined,
    additionalProperties: false,
  }
  if (name === 'business_analyze') {
    schema.oneOf = Object.entries(ANALYSIS_BRANCHES).map(([domain, config]) => ({
      title: `${config.label}统计`,
      properties: {
        domain: described({ const: domain }, `当前分支固定为 ${domain}`),
        metric: described({ type: 'string', enum: config.metrics }, `${config.label}支持的统计指标：${config.metrics.join('、')}`),
        date_from: properties.date_from,
        date_to: properties.date_to,
        ...(config.status ? { status: enumField(config.status, `${config.label}状态`) } : {}),
      },
      required: ['domain', 'metric'],
      additionalProperties: false,
    }))
  }
  return schema
}

function queryFieldSchema(toolName, field, fallback) {
  if (toolName === 'payment_search' && field === 'stage_id') {
    return described({ ...idField }, '合同付款阶段标识；先调用 business_get(domain=contract,target_id=项目ID)，从返回的 stages 中选择 id')
  }
  if (field === 'priority') return enumField(ENUMS.priority, '优先级')
  if (field === 'source_type') return enumField(ENUMS.sourceType, '关联类型')
  if (field === 'requirement_type') return enumField(ENUMS.requirementType, '需求类型')
  if (field === 'severity') return enumField(ENUMS.severity, '严重程度')
  if (field === 'urgency') return enumField(ENUMS.urgency, '紧急程度')
  if (field === 'is_overdue') return enumField(ENUMS.binary, '是否逾期')
  if (field === 'view') {
    const values = toolName === 'project_search' ? ['mine', 'joined'] : ['mine']
    return described({ type: 'string', enum: values }, values.length > 1
      ? '人员视角：mine=我负责的，joined=我参与的'
      : '人员视角：mine=我负责的')
  }
  if (field === 'sort_field') {
    return described({ type: 'string', enum: SORT_FIELDS[toolName] || [] }, '排序字段；仅可使用当前工具列出的字段')
  }
  if (field === 'sort_order') return described({ type: 'string', enum: ['asc', 'desc'] }, '排序方向：asc=升序，desc=降序')
  if (field === 'status') {
    if (toolName === 'business_analyze') return described({ type: 'integer' }, '业务状态；可选值由业务领域分支决定')
    if (toolName.startsWith('task_')) return enumField(ENUMS.taskStatus, '任务状态')
    if (toolName.startsWith('bug_')) return enumField(ENUMS.bugStatus, 'BUG状态')
    if (toolName.startsWith('work_order_')) return enumField(ENUMS.workOrderStatus, '工单状态')
    if (toolName.startsWith('requirement_')) return enumField(ENUMS.requirementStatus, '需求状态')
    if (toolName.startsWith('product_')) return enumField(ENUMS.enabled, '产品状态')
    return enumField(ENUMS.commonStatus, '状态')
  }
  if (field === 'page') return described({ type: 'integer', minimum: 1 }, FIELD_DESCRIPTIONS.page)
  if (field === 'page_size') return described({ type: 'integer', minimum: 1, maximum: 100 }, FIELD_DESCRIPTIONS.page_size)
  if (['keyword', 'name', 'title', 'problem_desc', 'submitter_name'].includes(field)) {
    return described({ type: 'string' }, FIELD_DESCRIPTIONS[field] || '文本筛选条件')
  }
  if (['created_at_from', 'created_at_to', 'submit_time_from', 'submit_time_to'].includes(field)) {
    return described({
      type: 'string',
      pattern: '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])(?:[T ][0-2]\\d:[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z|[+-][0-2]\\d:[0-5]\\d)?)?$',
    }, '时间边界，格式 YYYY-MM-DD 或 ISO 8601 日期时间')
  }
  if (field.endsWith('_date_from') || field.endsWith('_date_to') || field === 'date_from' || field === 'date_to') {
    return described({ type: 'string', format: 'date' }, FIELD_DESCRIPTIONS[field] || '日期边界，格式 YYYY-MM-DD')
  }
  if (field.endsWith('_month_from') || field.endsWith('_month_to')) {
    return described({ type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' }, '月份边界，格式 YYYY-MM')
  }
  if (field === 'owner_ids' || field === 'member_ids') return idArrayField
  if (field.endsWith('_id') || field === 'problem_type' || field === 'task_type') return withDescription(field, idField)
  return withDescription(field, fallback)
}

function actionInputSchema(name) {
  const properties = {
    mode: controlProperties.mode,
    confirmation_id: controlProperties.confirmation_id,
    ...((actionRequired[name] || []).includes('idempotency_key')
      ? { idempotency_key: controlProperties.idempotency_key }
      : {}),
    ...fields(actionFields[name] || []),
  }
  for (const key of ['owner_ids', 'ids']) if (key in properties) properties[key] = idArrayField
  for (const key of ['member_ids', 'collaborator_ids']) if (key in properties) properties[key] = optionalIdArrayField
  if ('items' in properties) properties.items = {
    type: 'array',
    description: '待批量新增的关键事项列表',
    minItems: 1,
    maxItems: 100,
    items: {
      type: 'object',
      properties: {
        name: withDescription('name', stringField),
        owner_id: withDescription('owner_id', idField),
        collaborator_ids: withDescription('collaborator_ids', optionalIdArrayField),
        original_due_date: withDescription('original_due_date', { type: 'string', format: 'date' }),
        requires_delivery_file: enumField(ENUMS.binary, '是否要求交付文件'),
        remark: withDescription('remark', nullableStringField),
      },
      required: ['name', 'owner_id', 'original_due_date'],
      additionalProperties: false,
    },
  }
  properties.items?.items?.properties && (properties.items.items.properties.name.maxLength = 200)
  if ('stages' in properties) properties.stages = {
    type: 'array',
    description: '合同付款阶段列表；编辑时传完整列表',
    minItems: 1,
    maxItems: 100,
    items: {
      type: 'object',
      properties: {
        id: withDescription('id', idField),
        stage_name: described({ type: 'string' }, '付款阶段名称'),
        planned_amount: described({ type: 'number', exclusiveMinimum: 0 }, '计划付款金额，必须大于 0'),
      },
      required: ['stage_name', 'planned_amount'],
      additionalProperties: false,
    },
  }
  properties.stages?.items?.properties && (properties.stages.items.properties.stage_name.maxLength = 100)
  if ('content_base64' in properties) properties.content_base64 = described({ type: 'string', maxLength: 12 * 1024 * 1024 }, 'Base64编码的文件内容；大小受服务端限制')
  for (const key of [
    'name', 'description', 'title', 'start_date', 'expected_end_date', 'actual_end_date', 'suspend_date',
    'progress_text', 'risk_text', 'submitter_name', 'submitter_dept', 'submit_date', 'pause_date',
    'completion_status', 'problem_desc', 'result_desc', 'expected_resolve_date', 'resolve_date', 'close_date',
    'resolved_date', 'closed_date',
    'activation_reason', 'submit_time', 'original_due_date', 'remark', 'pause_reason', 'new_due_date', 'reason',
    'contract_code', 'contract_name', 'supplier_name', 'signed_date', 'payment_month', 'file_name', 'mime_type',
  ]) {
    if (key in properties) {
      const dateLike = ['start_date', 'expected_end_date', 'actual_end_date', 'suspend_date', 'submit_date', 'pause_date',
        'expected_resolve_date', 'resolve_date', 'close_date', 'resolved_date', 'closed_date', 'original_due_date',
        'new_due_date', 'signed_date'].includes(key)
      const monthLike = key === 'payment_month'
      properties[key] = withDescription(key, dateLike
        ? { type: ['string', 'null'], format: 'date' }
        : monthLike
          ? { type: ['string', 'null'], pattern: '^\\d{4}-(0[1-9]|1[0-2])$' }
          : nullableStringField)
    }
  }
  const textLimits = {
    title: 200,
    submitter_name: 50,
    submitter_dept: 100,
    activation_reason: 100,
    pause_reason: 200,
    contract_code: 100,
    contract_name: 200,
    supplier_name: 100,
    file_name: 255,
    mime_type: 150,
  }
  if (properties.name) {
    properties.name.maxLength = name.startsWith('product_') || name.startsWith('stage_') && !name.startsWith('stage_item_')
      ? 100
      : 200
  }
  for (const [field, maxLength] of Object.entries(textLimits)) {
    if (properties[field]) properties[field].maxLength = maxLength
  }
  if (properties.submit_time) {
    properties.submit_time = described({
      type: ['string', 'null'],
      format: 'date-or-date-time',
    }, FIELD_DESCRIPTIONS.submit_time)
  }
  if ('requirement_type' in properties) properties.requirement_type = enumField(ENUMS.requirementType, '需求类型')
  if ('priority' in properties) properties.priority = enumField(ENUMS.priority, '优先级')
  if ('source_type' in properties) properties.source_type = enumField(ENUMS.sourceType, '关联类型')
  if ('severity' in properties) properties.severity = enumField(ENUMS.severity, '严重程度')
  if ('urgency' in properties) properties.urgency = enumField(ENUMS.urgency, '紧急程度')
  if ('requires_delivery_file' in properties) {
    properties.requires_delivery_file = described({ type: 'integer', enum: [0, 1] }, '是否要求交付文件：0=不要求，1=要求')
  }
  for (const key of ['id', 'parent_id', 'project_id', 'stage_id', 'item_id', 'payment_id', 'attachment_id', 'file_id', 'owner_id', 'product_id', 'supplier_id', 'handler_id', 'assignee_id', 'follower_id', 'task_type', 'bug_type_id', 'resolution_id', 'moved_id']) {
    if (key in properties) properties[key] = withDescription(key, idField)
  }
  if (name === 'payment_create' && properties.stage_id) {
    properties.stage_id = described({ ...idField }, '合同付款阶段标识；先调用 business_get(domain=contract,target_id=项目ID)，从返回的 stages 中选择 id')
  }
  if (name === 'stage_reorder' || name === 'stage_item_reorder') {
    properties.ids = described({ ...idArrayField }, '排序后的完整有序列表；必须且只能包含当前全部记录标识，不能遗漏、重复或混入其他记录')
  }
  for (const key of ['contract_amount', 'payment_amount']) {
    if (key in properties) properties[key] = described({ type: ['number', 'string', 'null'], exclusiveMinimum: 0 }, FIELD_DESCRIPTIONS[key])
  }
  if (statusActionSchemas[name]) properties.status = statusActionSchemas[name]
  const schema = { type: 'object', properties, required: actionRequired[name], additionalProperties: false }
  if (SOURCE_TARGET_ACTIONS.has(name)) {
    schema.allOf = [
      {
        if: { properties: { source_type: { const: 1 } }, required: ['source_type'] },
        then: { required: ['project_id'] },
      },
      {
        if: { properties: { source_type: { const: 2 } }, required: ['source_type'] },
        then: { required: ['requirement_id'] },
      },
    ]
  }
  const conditionalStatusFields = {
    project_change_status: { 2: ['actual_end_date'], 3: ['suspend_date'] },
    requirement_change_status: { 33: ['actual_end_date', 'completion_status'], 34: ['actual_end_date', 'completion_status'], 35: ['pause_date'] },
    task_change_status: { 2: ['actual_end_date'], 3: ['suspend_date'] },
    bug_change_status: { 1: ['resolved_date', 'resolution_id'], 2: ['closed_date'], 3: ['activation_reason'] },
    work_order_change_status: { 2: ['resolve_date', 'result_desc'], 4: ['suspend_date'], 5: ['activation_reason'] },
    stage_item_change_status: { 2: ['actual_end_date'], 3: ['pause_reason'] },
  }
  if (conditionalStatusFields[name]) {
    schema.allOf = [
      ...(schema.allOf || []),
      ...Object.entries(conditionalStatusFields[name]).map(([status, required]) => ({
        if: { properties: { status: { const: Number(status) } }, required: ['status'] },
        then: { required },
      })),
    ]
  }
  return schema
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
  business_options: '查询新增、编辑和状态操作所需的有效业务选项；返回可用标识和名称，不返回账号、工号、联系方式或凭据',
}

const queryTitles = {
  business_options: '查询业务选项',
  business_analyze: '统计业务数据',
}

const outputField = (description, type = ['string', 'number', 'integer', 'boolean', 'null']) => ({
  type,
  description,
})
const SEARCH_OUTPUT_FIELDS = {
  product_search: {
    id: outputField('产品标识'), name: outputField('产品名称'), description: outputField('产品描述'),
    owner_id: outputField('负责人标识'), owner_name: outputField('负责人姓名'),
    status: outputField('产品状态代码'), status_label: outputField('产品状态中文名称'),
    created_at: outputField('创建时间，ISO 8601日期时间'),
  },
  project_search: {
    id: outputField('项目标识'), name: outputField('项目名称'), product_name: outputField('所属产品名称'),
    owner_name: outputField('负责人姓名'), status: outputField('项目状态代码'),
    status_label: outputField('项目状态中文名称'), is_overdue: outputField('逾期代码'),
    is_overdue_label: outputField('逾期状态中文名称'), expected_end_date: outputField('预计完成日期，YYYY-MM-DD'),
    created_at: outputField('创建时间，ISO 8601日期时间'),
  },
  requirement_search: {
    id: outputField('需求标识'), title: outputField('需求标题'), requirement_type: outputField('需求类型代码'),
    requirement_type_label: outputField('需求类型中文名称'), priority: outputField('优先级代码'),
    priority_label: outputField('优先级中文名称'), status: outputField('需求状态代码'),
    status_label: outputField('需求状态中文名称'), owner_name: outputField('负责人姓名'),
    expected_end_date: outputField('预计完成日期，YYYY-MM-DD'),
  },
  task_search: {
    id: outputField('任务标识'), name: outputField('任务名称'), parent_task_id: outputField('父任务标识；空值表示主任务'),
    parent_task_name: outputField('父任务名称'), source_type: outputField('关联类型代码'),
    source_type_label: outputField('关联类型中文名称'), owner_names: outputField('负责人姓名，多个用顿号分隔'),
    task_type_name: outputField('任务类型名称'), priority: outputField('优先级代码'),
    priority_label: outputField('优先级中文名称'), status: outputField('任务状态代码'),
    status_label: outputField('任务状态中文名称'), is_overdue: outputField('逾期代码'),
    is_overdue_label: outputField('逾期状态中文名称'), expected_end_date: outputField('预计完成日期，YYYY-MM-DD'),
  },
  bug_search: {
    id: outputField('BUG标识'), title: outputField('BUG标题'), source_type: outputField('关联类型代码'),
    source_type_label: outputField('关联类型中文名称'), severity: outputField('严重程度代码'),
    severity_label: outputField('严重程度中文名称'), status: outputField('BUG状态代码'),
    status_label: outputField('BUG状态中文名称'), assignee_name: outputField('处理人姓名'),
  },
  work_order_search: {
    id: outputField('工单标识'), problem_desc: outputField('问题描述'), urgency: outputField('紧急程度代码'),
    urgency_label: outputField('紧急程度中文名称'), status: outputField('工单状态代码'),
    status_label: outputField('工单状态中文名称'), is_overdue: outputField('逾期代码'),
    is_overdue_label: outputField('逾期状态中文名称'), follower_name: outputField('跟进人姓名'),
    expected_resolve_date: outputField('预计解决日期，YYYY-MM-DD'),
  },
  stage_plan_search: {
    id: outputField('关键事项标识'), project_name: outputField('项目名称'), stage_name: outputField('阶段名称'),
    item_name: outputField('关键事项名称'), status: outputField('关键事项状态代码'),
    status_label: outputField('关键事项状态中文名称'), current_due_date: outputField('当前计划完成日期，YYYY-MM-DD'),
  },
  contract_search: {
    id: outputField('合同标识'), project_name: outputField('项目名称'), contract_code: outputField('合同编码'),
    contract_name: outputField('合同名称'), signed_date: outputField('签订日期，YYYY-MM-DD'),
    contract_amount: outputField('合同金额，单位：元'), supplier_name: outputField('供应商名称'),
  },
  payment_search: {
    id: outputField('付款记录标识'), project_name: outputField('项目名称'), stage_name: outputField('付款阶段名称'),
    payment_month: outputField('付款月份，YYYY-MM'), payment_amount: outputField('付款金额，单位：元'),
    handler_name: outputField('经办人姓名'),
  },
}

function resultItemSchema(name) {
  return {
    type: 'object',
    properties: SEARCH_OUTPUT_FIELDS[name] || {},
    additionalProperties: true,
  }
}

function searchOutputSchema(name, description = '统一分页查询结果') {
  return {
    type: 'object',
    description,
    properties: {
      items: { type: 'array', items: resultItemSchema(name), description: '当前页业务记录；每项均为符合筛选条件的独立记录' },
      total: { type: 'integer', description: '符合条件的记录总数' },
      page: { type: 'integer', description: '当前页码' },
      pageSize: { type: 'integer', description: '每页条数' },
      totalPages: { type: 'integer', description: '总页数' },
      hasNextPage: { type: 'boolean', description: '是否还有下一页' },
      viewCounts: { type: 'object', additionalProperties: { type: 'integer' }, description: '人员视角数量；仅部分列表返回' },
    },
    required: ['items', 'total', 'page', 'pageSize', 'totalPages', 'hasNextPage'],
    additionalProperties: false,
  }
}

function queryOutputSchema(name) {
  if (name.endsWith('_search') && name !== 'global_search') return searchOutputSchema(name)
  if (name === 'global_search') {
    return {
      type: 'object',
      description: '跨模块查询结果；results 中每个模块均使用统一分页结构',
      properties: {
        keyword: { type: ['string', 'null'], description: '实际使用的关键词' },
        results: { type: 'object', additionalProperties: searchOutputSchema('global_search'), description: '按内部查询名分组的结果' },
      },
      required: ['keyword', 'results'],
      additionalProperties: false,
    }
  }
  if (name === 'business_options') {
    return {
      type: 'object',
      description: '可用于新增、编辑或状态操作的有效选项',
      properties: {
        optionType: { type: 'string', description: '选项类型' },
        items: {
          type: 'array',
          description: '当前页选项',
          items: {
            type: 'object',
            properties: {
              id: { type: ['integer', 'string'], description: '选项标识' },
              name: { type: 'string', description: '原始名称' },
              displayName: { type: 'string', description: '可安全消歧的展示名称' },
            },
            required: ['id', 'name', 'displayName'],
            additionalProperties: false,
          },
        },
        total: { type: 'integer', description: '选项总数' },
        page: { type: 'integer', description: '当前页码' },
        pageSize: { type: 'integer', description: '每页条数' },
      },
      required: ['optionType', 'items', 'total', 'page', 'pageSize'],
      additionalProperties: false,
    }
  }
  if (name === 'business_analyze') {
    return {
      type: 'object',
      description: '业务统计结果',
      properties: {
        domain: { type: 'string', description: '业务领域' },
        metric: { type: 'string', description: '统计指标' },
        scope: { type: 'object', additionalProperties: true, description: '实际统计口径' },
        results: { type: 'array', items: resultItemSchema('business_analyze'), description: '统计结果' },
      },
      required: ['domain', 'metric', 'results'],
      additionalProperties: true,
    }
  }
  return {
    type: 'object',
    description: '业务详情或历史结果；固定业务代码同时返回中文标签',
    properties: {
      id: { type: ['integer', 'string'], description: '业务记录标识' },
      data: { description: '数组结果在结构化响应中的包装字段' },
      allowed_statuses: {
        type: 'array',
        description: '基于当前状态允许执行的下一状态',
        items: {
          type: 'object',
          properties: {
            value: { type: 'integer', description: '状态值' },
            label: { type: 'string', description: '状态名称' },
          },
          required: ['value', 'label'],
          additionalProperties: false,
        },
      },
    },
    additionalProperties: true,
  }
}

function actionOutputSchema() {
  return {
    type: 'object',
    description: 'preview 返回目标、变更、风险和确认号；execute 返回实际执行结果',
    properties: {
      riskLevel: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: '操作风险等级：low=低风险，medium=中风险，high=高风险',
      },
      riskReason: { type: ['string', 'null'], description: '风险等级的业务原因' },
      requiresConfirmation: { type: 'boolean', description: '是否必须取得用户明确确认后才能执行' },
      executed: { type: 'boolean', description: '本次响应是否已经实际执行了业务操作' },
      confirmationId: { type: 'string', description: '一次性操作确认号' },
      expiresAt: { type: 'string', description: '确认号失效时间' },
      affectedTargets: {
        type: 'array',
        items: resultItemSchema('action_target'),
        description: '预计或实际影响的业务对象',
      },
      resultStatus: {
        type: 'string',
        enum: ['preview', 'success', 'partial_success', 'failed'],
        description: '操作阶段或执行结果',
      },
      preview: { type: 'object', additionalProperties: true, description: '待执行操作的可读预览' },
      data: { description: '无对象结果在结构化响应中的包装字段' },
    },
    additionalProperties: true,
  }
}

function baseDefinition([name, menuPath], endpointType) {
  return {
    name,
    title: endpointType === 'action' ? actionTitle(name) : queryTitles[name] || titleFromName(name),
    description: endpointType === 'query'
      ? queryDescriptions[name] || `查询PMIS业务数据：${name}；搜索工具可不传任何参数`
      : `${actionTitle(name)}。必须先使用 preview 获取当前目标、风险和一次性确认号；仅在用户确认后，才使用完全相同的业务参数和确认号执行 execute。`,
    inputSchema: endpointType === 'query' ? queryInputSchema(name) : actionInputSchema(name),
    outputSchema: endpointType === 'query' ? queryOutputSchema(name) : actionOutputSchema(),
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

const commandCatalog = [
  ...QUERY_TOOLS.map((item) => baseDefinition(item, 'query')),
  ...ACTION_TOOLS.map((item) => baseDefinition(item, 'action')),
]

const PUBLIC_QUERY_NAMES = [
  'global_search',
  'product_search',
  'project_search',
  'stage_plan_search',
  'contract_search',
  'payment_search',
  'requirement_search',
  'task_search',
  'bug_search',
  'work_order_search',
  'business_options',
]

const PUBLIC_ACTION_GROUPS = [
  ['product_manage', '产品新增、编辑或删除', {
    create: 'product_create', update: 'product_update', delete: 'product_delete',
  }],
  ['product_status', '产品状态变更', { change_status: 'product_change_status' }],
  ['project_manage', '项目新增、编辑或删除', {
    create: 'project_create', update: 'project_update', delete: 'project_delete',
  }],
  ['project_status', '项目状态变更', { change_status: 'project_change_status' }],
  ['requirement_manage', '需求新增、编辑或删除', {
    create: 'requirement_create', update: 'requirement_update', delete: 'requirement_delete',
  }],
  ['requirement_status', '需求状态变更', { change_status: 'requirement_change_status' }],
  ['task_manage', '任务新增、创建子任务、编辑或删除', {
    create: 'task_create', create_subtask: 'task_create_subtask', update: 'task_update', delete: 'task_delete',
  }],
  ['task_flow', '任务指派或状态变更', {
    assign: 'task_assign', change_status: 'task_change_status',
  }],
  ['bug_manage', 'BUG新增、编辑或删除', {
    create: 'bug_create', update: 'bug_update', delete: 'bug_delete',
  }],
  ['bug_flow', 'BUG指派或状态变更', {
    assign: 'bug_assign', change_status: 'bug_change_status',
  }],
  ['work_order_manage', '运维工单新增、编辑或删除', {
    create: 'work_order_create', update: 'work_order_update', delete: 'work_order_delete',
  }],
  ['work_order_flow', '运维工单指派或状态变更', {
    assign: 'work_order_assign', change_status: 'work_order_change_status',
  }],
  ['stage_manage', '项目阶段新增、编辑、排序或删除', {
    create: 'stage_create', update: 'stage_update', reorder: 'stage_reorder', delete: 'stage_delete',
  }],
  ['stage_item_manage', '关键事项新增、批量新增、编辑、排序或删除', {
    create: 'stage_item_create', batch_create: 'stage_item_batch_create', update: 'stage_item_update',
    reorder: 'stage_item_reorder', delete: 'stage_item_delete',
  }],
  ['stage_item_flow', '关键事项状态变更或计划调整', {
    change_status: 'stage_item_change_status', adjust: 'stage_item_adjust',
  }],
  ['contract_manage', '项目合同新增、编辑或删除', {
    create: 'contract_create', update: 'contract_update', delete: 'contract_delete',
  }],
  ['payment_manage', '付款记录新增、编辑或删除', {
    create: 'payment_create', update: 'payment_update', delete: 'payment_delete',
  }],
  ['contract_attachment_manage', '合同附件上传或删除', {
    upload: 'contract_attachment_upload', delete: 'contract_attachment_delete',
  }],
  ['stage_delivery_manage', '关键事项交付文件上传或删除', {
    upload: 'stage_delivery_upload', delete: 'stage_delivery_delete',
  }],
]

function commandDefinition(name, endpointType) {
  return commandCatalog.find((tool) => tool.name === name && tool._meta.endpointType === endpointType)
}

function genericQueryDefinition(name, title, domains, description) {
  return {
    name,
    title,
    description,
    inputSchema: {
      type: 'object',
      properties: {
        domain: described({ type: 'string', enum: domains }, `业务领域：${domains.join('、')}`),
        target_id: described({
          type: ['integer', 'string'],
          minimum: 1,
          pattern: '^[1-9]\\d*$',
        }, '正整数目标记录标识；阶段主计划和合同传项目标识'),
      },
      required: ['domain', 'target_id'],
      additionalProperties: false,
    },
    outputSchema: queryOutputSchema(name),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    _meta: { endpointType: 'query', menuPath: null },
  }
}

function publicActionDefinition([name, title, operations]) {
  const entries = Object.entries(operations)
  const definitions = entries.map(([, command]) => commandDefinition(command, 'action'))
  const properties = {
    operation: described({ type: 'string', enum: entries.map(([operation]) => operation) },
      `业务操作：${entries.map(([operation]) => operation).join('、')}`),
  }
  for (const definition of definitions) {
    for (const [field, schema] of Object.entries(definition.inputSchema.properties || {})) {
      if (!properties[field]) properties[field] = schema
    }
  }
  return {
    name,
    title,
    description: `${title}。通过 operation 选择具体操作；所有操作必须先 preview，用户确认后再 execute。`,
    inputSchema: {
      type: 'object',
      properties,
      required: ['operation'],
      oneOf: entries.map(([operation], index) => {
        const definition = definitions[index]
        return {
          title: definition.title,
          properties: {
            operation: described({ const: operation }, `当前分支固定为 ${operation}`),
            ...definition.inputSchema.properties,
          },
          required: ['operation', ...(definition.inputSchema.required || [])],
          additionalProperties: false,
          ...(definition.inputSchema.allOf ? { allOf: definition.inputSchema.allOf } : {}),
        }
      }),
      additionalProperties: false,
    },
    outputSchema: actionOutputSchema(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: entries.some(([operation]) => operation === 'delete'),
      idempotentHint: false,
    },
    _meta: {
      endpointType: 'action',
      menuPath: definitions[0]._meta.menuPath,
      operations,
    },
  }
}

const publicToolCatalog = [
  ...PUBLIC_QUERY_NAMES.map((name) => commandDefinition(name, 'query')),
  genericQueryDefinition(
    'business_get',
    '读取业务详情',
    ['product', 'project', 'stage_plan', 'contract', 'requirement', 'task', 'bug', 'work_order'],
    '按业务领域和目标标识读取当前详情；应先使用对应搜索工具定位目标'
  ),
  genericQueryDefinition(
    'business_history',
    '读取业务变更历史',
    ['product', 'project', 'stage_plan', 'requirement', 'task', 'bug', 'work_order'],
    '按业务领域和目标标识读取变更历史；阶段主计划传项目标识'
  ),
  commandDefinition('business_analyze', 'query'),
  ...PUBLIC_ACTION_GROUPS.map(publicActionDefinition),
]

const DOMAIN_MENU_PATHS = {
  product: '/products',
  project: '/projects',
  stage_plan: '/projects',
  contract: '/projects',
  requirement: '/requirements',
  task: '/tasks',
  bug: '/bugs',
  work_order: '/work-orders',
}

const OPTION_MENU_PATHS = {
  user: null,
  task_type: '/tasks',
  bug_type: '/bugs',
  bug_resolution: '/bugs',
  work_order_problem_type: '/work-orders',
  supplier: '/projects',
}

function scopeGenericQueryDomains(tool, allowedMenuPaths) {
  if (!['business_get', 'business_history'].includes(tool.name)) return tool
  const domain = tool.inputSchema.properties.domain
  return {
    ...tool,
    inputSchema: {
      ...tool.inputSchema,
      properties: {
        ...tool.inputSchema.properties,
        domain: {
          ...domain,
          enum: domain.enum.filter((item) => allowedMenuPaths.has(DOMAIN_MENU_PATHS[item])),
        },
      },
    },
  }
}

function scopeBusinessOptions(tool, allowedMenuPaths) {
  if (tool.name !== 'business_options') return tool
  const optionType = tool.inputSchema.properties.option_type
  return {
    ...tool,
    inputSchema: {
      ...tool.inputSchema,
      properties: {
        ...tool.inputSchema.properties,
        option_type: {
          ...optionType,
          enum: optionType.enum.filter((item) => !OPTION_MENU_PATHS[item] || allowedMenuPaths.has(OPTION_MENU_PATHS[item])),
        },
      },
    },
  }
}

const ANALYSIS_DOMAIN_MENU_PATHS = {
  product: '/products',
  project: '/projects',
  requirement: '/requirements',
  task: '/tasks',
  bug: '/bugs',
  work_order: '/work-orders',
  contract: '/projects',
  payment: '/projects',
}

function scopeBusinessAnalysis(tool, allowedMenuPaths) {
  if (tool.name !== 'business_analyze') return tool
  const domain = tool.inputSchema.properties.domain
  return {
    ...tool,
    inputSchema: {
      ...tool.inputSchema,
      properties: {
        ...tool.inputSchema.properties,
        domain: {
          ...domain,
          enum: domain.enum.filter((item) => allowedMenuPaths.has(ANALYSIS_DOMAIN_MENU_PATHS[item])),
        },
      },
    },
  }
}

function filterToolsForContext(context) {
  return publicToolCatalog.filter((tool) => {
    if (tool._meta.endpointType !== context.endpointType) return false
    if (!tool._meta.menuPath) {
      return context.endpointType === 'query' && context.allowedMenuPaths.size > 0
    }
    return context.allowedMenuPaths.has(tool._meta.menuPath)
  }).map((tool) => scopeGenericQueryDomains(tool, context.allowedMenuPaths))
    .map((tool) => scopeBusinessOptions(tool, context.allowedMenuPaths))
    .map((tool) => scopeBusinessAnalysis(tool, context.allowedMenuPaths))
    .map(({ _meta, ...tool }) => tool)
}

function getToolDefinition(name, endpointType) {
  return getPublicToolDefinition(name, endpointType) || commandDefinition(name, endpointType)
}

function getPublicToolDefinition(name, endpointType) {
  return publicToolCatalog.find((tool) => tool.name === name && tool._meta.endpointType === endpointType)
}

function getCommandDefinition(name, endpointType) {
  return commandDefinition(name, endpointType)
}

function resolvePublicTool(name, args, endpointType) {
  if (name === 'business_get' || name === 'business_history') {
    const suffix = name === 'business_get' ? 'get' : 'history'
    const command = `${args.domain}_${suffix}`
    const targetField = ['stage_plan', 'contract'].includes(args.domain) ? 'project_id' : 'id'
    return {
      name: command,
      args: { [targetField]: args.target_id },
    }
  }
  if (endpointType === 'action') {
    const definition = getPublicToolDefinition(name, endpointType)
    const operations = definition?._meta.operations
    const command = operations && Object.prototype.hasOwnProperty.call(operations, args.operation)
      ? operations[args.operation]
      : null
    if (!command) {
      const error = new Error('operation 与当前工具不匹配')
      error.code = 'MCP_ARGUMENT_INVALID'
      error.fieldErrors = { operation: error.message }
      throw error
    }
    const commandArgs = { ...args }
    delete commandArgs.operation
    return { name: command, args: commandArgs }
  }
  return { name, args }
}

module.exports = {
  commandCatalog,
  filterToolsForContext,
  getCommandDefinition,
  getPublicToolDefinition,
  getToolDefinition,
  OPTION_MENU_PATHS,
  publicToolCatalog,
  resolvePublicTool,
  toolCatalog: commandCatalog,
}
