const product = require('../controllers/productController')
const project = require('../controllers/projectController')
const stage = require('../controllers/projectStagePlanController')
const contract = require('../controllers/projectContractController')
const requirement = require('../controllers/requirementController')
const task = require('../controllers/taskController')
const bug = require('../controllers/bugController')
const workOrder = require('../controllers/workOrderController')
const followUpRecord = require('../controllers/followUpRecordController')
const { createBusinessAttachmentController } = require('../controllers/businessAttachmentController')
const db = require('../db')
const ticketService = require('../services/mcpActionTicketService')
const { redactAuditInput } = require('../services/mcpAuditService')
const { allowedProjectStatuses, validateProjectStatusChange } = require('../services/productProjectRules')
const { allowedRequirementStatuses, validateRequirementStatusChange } = require('../services/requirementRules')
const { allowedTaskStatuses, validateTaskStatusChange, canCompleteParent, canLeaveCompletedSubtask } = require('../services/taskRules')
const { allowedBugStatuses, validateBugStatusChange } = require('../services/bugRules')
const { allowedWorkOrderStatuses, resolveWorkOrderResultFields, validateWorkOrderResultFields } = require('../services/workOrderStatusRules')
const { allowedPlanItemStatuses, validatePlanItemStatusChange } = require('../services/projectStagePlanRules')
const { normalizePaymentMonth, validateContractStages, validatePaymentAmount } = require('../services/projectContractRules')
const { validateAttachmentFile } = require('../services/projectContractAttachmentService')
const { OSS_FILE_ORIGIN } = require('../services/projectContractOssService')
const { validateActualBusinessDate } = require('../services/actualBusinessDateRules')
const { normalizeFollowUpContent, resolveFollowUpTarget } = require('../services/followUpRecordRules')
const { invokeController } = require('./controllerAdapter')
const { unwrapEnvelope } = require('./queryTools')

const highRiskPattern = /(delete|change_status|change_priority|reorder|adjust|payment|assign|upload|batch)/
const ACTUAL_DATE_FIELDS = {
  actual_end_date: '实际完成时间',
  resolved_date: '修复时间',
  closed_date: '关闭时间',
  resolve_date: '实际修复时间',
  close_date: '关闭时间',
}

function validateActionActualDates(args) {
  for (const [field, label] of Object.entries(ACTUAL_DATE_FIELDS)) {
    const message = validateActualBusinessDate(args[field], label)
    if (message) throw businessValidationError(field, message)
  }
}
const FILE_LIMIT = Number(process.env.MCP_FILE_INLINE_LIMIT || 20 * 1024 * 1024)
const MAIN_TARGETS = {
  product: {
    table: 'pms_product',
    nameColumn: 'name',
    currentFields: ['status', 'owner_id'],
  },
  project: {
    table: 'pms_project',
    nameColumn: 'name',
    currentFields: ['status', 'priority', 'product_id', 'requirement_id', 'owner_id', 'expected_end_date'],
  },
  requirement: {
    table: 'pms_requirement',
    nameColumn: 'title',
    currentFields: ['status', 'priority', 'requirement_type', 'product_id', 'owner_id'],
  },
  task: {
    table: 'pms_task',
    nameColumn: 'name',
    currentFields: ['status', 'priority', 'source_type', 'project_id', 'requirement_id', 'owner_ids'],
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
  stage_order: '阶段顺序',
  stage_item_order: '关键事项顺序',
  contract: '项目合同',
  payment: '付款记录',
  contract_attachment: '合同附件',
  stage_delivery: '交付文件',
  business_attachment: '业务附件',
  payment_stage: '付款阶段',
  follow_up_record: '跟进记录',
}
const STATUS_LABELS = {
  product: { 0: '停用', 1: '启用' },
  project: { 0: '未开始', 1: '进行中', 2: '已完成', 3: '已暂停' },
  requirement: {
    0: '上会评估', 1: '需求上会', 2: '上会通过', 3: '过会未通过',
    10: '提报评估', 11: '需求审批', 12: '审批通过', 13: '审批未通过',
    20: '需求验证', 21: '预研通过', 22: '预研不通过',
    30: '需求整理', 31: '实施中', 32: '试运行', 33: '已完成',
    34: '已完成未使用', 35: '暂停',
  },
  task: { 0: '待处理', 1: '处理中', 2: '已完成', 3: '已暂停' },
  bug: { 0: '新建', 1: '已修复', 2: '已关闭', 3: '被激活' },
  work_order: { 0: '待处理', 1: '处理中', 2: '已解决', 4: '已暂停', 5: '被激活' },
  stage_item: { 0: '未开始', 1: '进行中', 2: '已完成', 3: '已暂停' },
}

function cleanBody(args) {
  const body = { ...args }
  for (const key of [
    'mode', 'confirmation_id', 'idempotency_key', 'id',
    'attachment_id', 'file_id', 'file_name', 'mime_type', 'file_url', 'files',
  ]) delete body[key]
  return body
}

async function uploadBusinessAttachmentFromMcp(req, res) {
  return createBusinessAttachmentController(req.body.business_type).upload(req, res)
}

async function deleteBusinessAttachmentFromMcp(req, res) {
  return createBusinessAttachmentController(req.body.business_type).remove(req, res)
}

function buildPreviewChanges(args) {
  const changes = { ...args }
  for (const key of ['mode', 'confirmation_id', 'idempotency_key']) delete changes[key]
  return redactAuditInput(changes)
}

function id(args, key = 'id') {
  if (args[key] === undefined || args[key] === '') throw businessValidationError(key, `缺少参数：${key}`)
  return args[key]
}

function currentSnapshot(row, fields) {
  return Object.fromEntries(fields.map((field) => [field, row[field]]))
}

function businessValidationError(field, message) {
  const error = new Error(message)
  error.code = 'MCP_BUSINESS_VALIDATION'
  error.fieldErrors = { [field]: message }
  return error
}

function preserveOmittedFields(args, row, fields) {
  const merged = { ...args }
  for (const field of fields) {
    if (merged[field] === undefined && Object.prototype.hasOwnProperty.call(row, field)) {
      merged[field] = row[field] ?? null
    }
  }
  return merged
}

const UPDATE_SPECS = {
  product_update: {
    sql: 'SELECT name, description, owner_id FROM pms_product WHERE id = ? AND is_deleted = 0',
    params: (args) => [args.id],
    fields: ['name', 'description', 'owner_id'],
  },
  project_update: {
    sql: `SELECT name, description, product_id, requirement_id, owner_id, start_date, expected_end_date, progress_text, risk_text
      FROM pms_project WHERE id = ? AND is_deleted = 0`,
    params: (args) => [args.id],
    fields: ['name', 'description', 'product_id', 'requirement_id', 'owner_id', 'start_date', 'expected_end_date', 'progress_text', 'risk_text'],
    relationship: {
      field: 'member_ids',
      sql: 'SELECT user_id id FROM pms_project_member WHERE project_id = ? ORDER BY user_id',
      params: (args) => [args.id],
    },
  },
  requirement_update: {
    sql: `SELECT title, description, requirement_type, product_id, owner_id,
      submitter_name, submitter_dept, submit_date, start_date, expected_end_date
      FROM pms_requirement WHERE id = ? AND is_deleted = 0`,
    params: (args) => [args.id],
    fields: ['title', 'description', 'requirement_type', 'product_id', 'owner_id',
      'submitter_name', 'submitter_dept', 'submit_date', 'start_date', 'expected_end_date'],
  },
  task_update: {
    sql: `SELECT name, description, source_type, project_id, requirement_id, task_type, start_date, expected_end_date
      FROM pms_task WHERE id = ? AND is_deleted = 0`,
    params: (args) => [args.id],
    fields: ['name', 'description', 'source_type', 'project_id', 'requirement_id', 'task_type', 'start_date', 'expected_end_date'],
    relationship: {
      field: 'owner_ids',
      sql: 'SELECT user_id id FROM pms_task_owner WHERE task_id = ? ORDER BY sort_order, user_id',
      params: (args) => [args.id],
    },
  },
  bug_update: {
    sql: `SELECT title, description, source_type, project_id, requirement_id, bug_type_id, severity, assignee_id
      FROM pms_bug WHERE id = ? AND is_deleted = 0`,
    params: (args) => [args.id],
    fields: ['title', 'description', 'source_type', 'project_id', 'requirement_id', 'bug_type_id', 'severity', 'assignee_id'],
  },
  work_order_update: {
    sql: `SELECT product_id, problem_type, problem_desc, result_desc, follower_id, urgency,
      expected_resolve_date, resolve_date, submitter_name, submitter_dept, submit_time
      FROM pms_work_order WHERE id = ? AND is_deleted = 0`,
    params: (args) => [args.id],
    fields: ['product_id', 'problem_type', 'problem_desc', 'result_desc', 'follower_id', 'urgency',
      'expected_resolve_date', 'resolve_date', 'submitter_name', 'submitter_dept', 'submit_time'],
  },
  stage_update: {
    sql: `SELECT s.name, s.description FROM pms_project_plan_stage s
      WHERE s.id = ? AND s.project_id = ? AND s.is_deleted = 0`,
    params: (args) => [args.stage_id, args.project_id],
    fields: ['name', 'description'],
  },
  stage_item_update: {
    sql: `SELECT i.stage_id, i.name, i.owner_id, i.requires_delivery_file, i.remark FROM pms_project_plan_item i
      JOIN pms_project_plan_stage s ON s.id = i.stage_id AND s.is_deleted = 0
      WHERE i.id = ? AND s.project_id = ? AND i.is_deleted = 0`,
    params: (args) => [args.item_id, args.project_id],
    fields: ['stage_id', 'name', 'owner_id', 'requires_delivery_file', 'remark'],
    relationship: {
      field: 'collaborator_ids',
      sql: 'SELECT user_id id FROM pms_project_plan_item_collaborator WHERE plan_item_id = ? ORDER BY sort_order, user_id',
      params: (args) => [args.item_id],
    },
  },
  contract_update: {
    sql: `SELECT id, contract_code, contract_name, supplier_id, signed_date, contract_amount, remark
      FROM pms_project_contract WHERE project_id = ? AND is_deleted = 0`,
    params: (args) => [args.project_id],
    fields: ['contract_code', 'contract_name', 'supplier_id', 'signed_date', 'contract_amount', 'remark'],
    relationship: {
      field: 'stages',
      when: (_args, row) => row.id !== undefined && row.id !== null,
      sql: `SELECT id, stage_name, planned_amount FROM pms_project_payment_stage
        WHERE contract_id = ? AND is_deleted = 0 ORDER BY sort_order, id`,
      params: (_args, row) => [row.id],
      map: (item) => ({
        id: Number(item.id),
        stage_name: item.stage_name,
        planned_amount: Number(item.planned_amount),
      }),
    },
  },
  payment_update: {
    sql: `SELECT r.payment_amount, r.payment_month, r.handler_id, r.remark FROM pms_project_payment_record r
      JOIN pms_project_payment_stage s ON s.id = r.stage_id AND s.is_deleted = 0
      JOIN pms_project_contract c ON c.id = s.contract_id AND c.is_deleted = 0
      WHERE r.id = ? AND c.project_id = ? AND r.is_deleted = 0`,
    params: (args) => [args.payment_id, args.project_id],
    fields: ['payment_amount', 'payment_month', 'handler_id', 'remark'],
  },
}

async function mergeActionUpdateArguments(name, args, database = db) {
  const spec = UPDATE_SPECS[name]
  if (!spec) return { ...args }
  const row = await database.prepare(spec.sql).get(...spec.params(args))
  if (!row) return { ...args }
  const merged = preserveOmittedFields(args, row, spec.fields)
  if (spec.relationship && merged[spec.relationship.field] === undefined
    && (!spec.relationship.when || spec.relationship.when(args, row))) {
    const rows = await database.prepare(spec.relationship.sql).all(...spec.relationship.params(args, row))
    merged[spec.relationship.field] = rows.map(spec.relationship.map || ((item) => Number(item.id)))
  }
  return merged
}

async function statusRow(database, sql, params, field, missingMessage) {
  const row = await database.prepare(sql).get(...params)
  if (!row) throw businessValidationError(field, missingMessage)
  return row
}

function rejectTransition(domain, current, allowed) {
  const mapping = STATUS_LABELS[domain]
  const currentText = `${mapping[current] || '未知'}(${current})`
  const allowedText = allowed.length
    ? allowed.map((value) => `${mapping[value] || '未知'}(${value})`).join('、')
    : '无'
  throw businessValidationError('status', `当前状态：${currentText}；允许变更为：${allowedText}`)
}

async function validateStatusAction(name, args, database = db) {
  if (!name.endsWith('_change_status')) return
  const target = Number(args.status)

  if (name === 'product_change_status') {
    await statusRow(database, 'SELECT status FROM pms_product WHERE id = ? AND is_deleted = 0', [args.id], 'id', '产品不存在')
    if (![0, 1].includes(target)) throw businessValidationError('status', '产品状态不正确')
    return
  }

  if (name === 'project_change_status') {
    const row = await statusRow(database, 'SELECT status FROM pms_project WHERE id = ? AND is_deleted = 0', [args.id], 'id', '项目不存在')
    const allowed = allowedProjectStatuses(row.status)
    if (!allowed.includes(target)) rejectTransition('project', row.status, allowed)
    const message = validateProjectStatusChange(target, args)
    if (message) throw businessValidationError(target === 2 ? 'actual_end_date' : 'suspend_date', message)
    return
  }

  if (name === 'requirement_change_status') {
    const row = await statusRow(database, 'SELECT status, requirement_type FROM pms_requirement WHERE id = ? AND is_deleted = 0', [args.id], 'id', '需求不存在')
    const allowed = allowedRequirementStatuses(row.requirement_type, row.status)
    if (!allowed.includes(target)) rejectTransition('requirement', row.status, allowed)
    const message = validateRequirementStatusChange(target, args)
    if (message) {
      const field = !args.actual_end_date && [33, 34].includes(target)
        ? 'actual_end_date'
        : !String(args.completion_status || '').trim() && [33, 34].includes(target)
          ? 'completion_status'
          : 'pause_date'
      throw businessValidationError(field, message)
    }
    return
  }

  if (name === 'task_change_status') {
    const row = await statusRow(database, `SELECT t.id, t.status, t.parent_task_id, parent.status parent_status,
      CASE WHEN t.status = 3 THEN (
        SELECT old_value::INTEGER FROM pms_op_log l
        WHERE l.module = '任务' AND l.target_id = t.id AND l.action = '状态变更'
          AND l.field_name = 'status' AND l.new_value = '3'
        ORDER BY l.created_at DESC LIMIT 1
      ) END previous_status
      FROM pms_task t LEFT JOIN pms_task parent ON parent.id = t.parent_task_id
      WHERE t.id = ? AND t.is_deleted = 0`, [args.id], 'id', '任务不存在')
    const allowed = allowedTaskStatuses(row.status, row.previous_status)
    if (!allowed.includes(target)) rejectTransition('task', row.status, allowed)
    if (!row.parent_task_id && target === 2) {
      const children = await database.prepare(`SELECT COUNT(*)::INTEGER total,
        COUNT(*) FILTER (WHERE status = 2)::INTEGER completed
        FROM pms_task WHERE parent_task_id = ? AND is_deleted = 0`).get(row.id)
      if (!canCompleteParent(children.completed, children.total)) {
        throw businessValidationError('status', `主任务下还有 ${Number(children.total) - Number(children.completed)} 个未完成子任务，不能完成主任务`)
      }
    }
    if (row.parent_task_id && Number(row.status) === 2 && target !== 2 && !canLeaveCompletedSubtask(row.parent_status)) {
      throw businessValidationError('status', '主任务已完成，请先调整主任务状态')
    }
    const message = validateTaskStatusChange(target, args)
    if (message) throw businessValidationError(target === 2 ? 'actual_end_date' : 'suspend_date', message)
    return
  }

  if (name === 'bug_change_status') {
    const row = await statusRow(database, 'SELECT status FROM pms_bug WHERE id = ? AND is_deleted = 0', [args.id], 'id', 'BUG不存在')
    const allowed = allowedBugStatuses(row.status)
    if (!allowed.includes(target)) rejectTransition('bug', row.status, allowed)
    const message = validateBugStatusChange(target, args)
    if (message) {
      const field = target === 1
        ? (!args.resolved_date ? 'resolved_date' : 'resolution_id')
        : target === 2 ? 'closed_date' : 'activation_reason'
      throw businessValidationError(field, message)
    }
    if (target === 1) {
      const resolution = await database.prepare(`SELECT a.id FROM pms_archive a
        JOIN pms_archive_type t ON t.id = a.archive_type_id
        WHERE a.id = ? AND a.is_deleted = 0 AND a.status = 1
          AND t.is_deleted = 0 AND t.status = 1 AND t.name = 'Bug解决方案'`).get(args.resolution_id)
      if (!resolution) throw businessValidationError('resolution_id', '解决方案不存在或已停用')
    }
    return
  }

  if (name === 'work_order_change_status') {
    const row = await statusRow(database, `SELECT status, resolve_date, close_date, result_desc, suspend_date, activation_reason
      FROM pms_work_order WHERE id = ? AND is_deleted = 0`, [args.id], 'id', '工单不存在')
    const allowed = allowedWorkOrderStatuses(row.status)
    if (!allowed.includes(target)) rejectTransition('work_order', row.status, allowed)
    const values = resolveWorkOrderResultFields(target, args, row)
    const message = validateWorkOrderResultFields(target, values)
    if (message) {
      const field = target === 2
        ? (!args.resolve_date ? 'resolve_date' : 'result_desc')
        : target === 4 ? 'suspend_date' : 'activation_reason'
      throw businessValidationError(field, message)
    }
    return
  }

  if (name === 'stage_item_change_status') {
    const row = await statusRow(database, `SELECT i.status, i.previous_status, i.requires_delivery_file,
      (SELECT COUNT(*) FROM pms_project_plan_delivery_file f
        WHERE f.plan_item_id = i.id AND f.is_current = 1 AND f.is_void = 0) active_file_count
      FROM pms_project_plan_item i
      JOIN pms_project_plan_stage s ON s.id = i.stage_id AND s.is_deleted = 0
      WHERE i.id = ? AND s.project_id = ? AND i.is_deleted = 0`,
    [args.item_id, args.project_id], 'item_id', '关键事项不存在')
    const allowed = allowedPlanItemStatuses(row.status, row.previous_status)
    if (!allowed.includes(target)) rejectTransition('stage_item', row.status, allowed)
    const message = validatePlanItemStatusChange(target, args, Number(row.requires_delivery_file) === 1, row.active_file_count)
    if (message) {
      const field = target === 2
        ? (!args.actual_end_date ? 'actual_end_date' : 'status')
        : 'pause_reason'
      throw businessValidationError(field, message)
    }
  }
}

async function loadOneTarget(database, {
  sql,
  params,
  type,
  missingMessage,
  currentFields = [],
}) {
  const row = await database.prepare(sql).get(...params)
  if (!row) throw businessValidationError(type === 'stage_item' ? 'item_id' : 'id', missingMessage)
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

function mainTargetCurrentSelect(type, spec) {
  const columns = spec.currentFields.filter((field) => field !== 'owner_ids')
  if (type === 'task') {
    columns.push(`ARRAY(
      SELECT task_owner.user_id
      FROM pms_task_owner task_owner
      WHERE task_owner.task_id = ${spec.table}.id
      ORDER BY task_owner.sort_order, task_owner.user_id
    ) owner_ids`)
  }
  return columns.join(', ')
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
    if (ids.some((value) => !Number.isInteger(value) || value <= 0)) {
      throw businessValidationError('ids', `${label}标识不合法：必须全部是正整数`)
    }
    const rows = ids.length
      ? await database.prepare(`SELECT id, ${spec.nameColumn} name, ${mainTargetCurrentSelect(type, spec)}
        FROM ${spec.table} WHERE id IN (${ids.map(() => '?').join(',')}) AND is_deleted = 0`).all(...ids)
      : []
    if (rows.length !== ids.length) throw businessValidationError('ids', `部分${label}不存在或已删除`)
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
    sql: `SELECT id, ${spec.nameColumn} name, ${mainTargetCurrentSelect(type, spec)}
      FROM ${spec.table} WHERE id = ? AND is_deleted = 0`,
    params: [targetId],
    type,
    missingMessage: `${label}不存在`,
    currentFields: spec.currentFields,
  })
}

function buildReorderTarget(type, parent, rows, args) {
  const currentIds = rows.map((row) => Number(row.id))
  const proposedIds = (args.ids || []).map(Number)
  const uniqueIds = new Set(proposedIds)
  const sameMembers = proposedIds.length === currentIds.length
    && uniqueIds.size === proposedIds.length
    && currentIds.every((value) => uniqueIds.has(value))
  if (!sameMembers) {
    throw businessValidationError('ids', '排序列表必须包含当前全部记录标识，且不能遗漏、重复或混入其他记录')
  }
  const movedId = Number(args.moved_id)
  if (!uniqueIds.has(movedId)) {
    throw businessValidationError('moved_id', '被移动记录必须包含在排序列表中')
  }
  const byId = new Map(rows.map((row) => [Number(row.id), {
    id: Number(row.id),
    name: row.name,
    sortOrder: Number(row.sort_order),
    ...(row.owner_id == null ? {} : { owner_id: Number(row.owner_id) }),
  }]))
  const current = { order: currentIds.map((value) => byId.get(value)) }
  if (parent.owner_id != null) current.owner_id = Number(parent.owner_id)
  return {
    type,
    id: parent.id,
    name: parent.name,
    current,
    proposed: {
      movedId,
      order: proposedIds.map((value, index) => ({
        ...byId.get(value),
        sortOrder: index + 1,
      })),
    },
  }
}

async function loadReorderTargetSnapshot(name, args, database) {
  if (name === 'stage_reorder') {
    const project = await database.prepare(
      'SELECT id, name, owner_id FROM pms_project WHERE id = ? AND is_deleted = 0'
    ).get(args.project_id)
    if (!project) throw businessValidationError('project_id', '项目不存在')
    const rows = await database.prepare(`SELECT s.id, s.name, s.sort_order
      FROM pms_project_plan_stage s
      WHERE s.project_id = ? AND s.is_deleted = 0
      ORDER BY s.sort_order ASC, s.id ASC`).all(args.project_id)
    return buildReorderTarget('stage_order', project, rows, args)
  }
  if (name === 'stage_item_reorder') {
    const stage = await database.prepare(`SELECT s.id, s.name
      FROM pms_project_plan_stage s
      JOIN pms_project p ON p.id = s.project_id AND p.is_deleted = 0
      WHERE s.id = ? AND s.project_id = ? AND s.is_deleted = 0`)
      .get(args.stage_id, args.project_id)
    if (!stage) throw businessValidationError('stage_id', '阶段不存在')
    const rows = await database.prepare(`SELECT i.id, i.name, i.sort_order, i.owner_id
      FROM pms_project_plan_item i
      WHERE i.stage_id = ? AND i.is_deleted = 0
      ORDER BY i.sort_order ASC, i.id ASC`).all(args.stage_id)
    return buildReorderTarget('stage_item_order', stage, rows, args)
  }
  return null
}

async function loadActionTargetSnapshot(name, args, database = db) {
  if (name.startsWith('follow_up_record_')) {
    const target = resolveFollowUpTarget(args.target_type, args.target_id)
    const nameColumn = { project: 'name', requirement: 'title', task: 'name' }[args.target_type]
    if (name === 'follow_up_record_create') {
      const row = await database.prepare(`SELECT id, ${nameColumn} name FROM ${target.table}
        WHERE id = ? AND is_deleted = 0`).get(target.id)
      if (!row) throw businessValidationError('target_id', `${target.module}不存在`)
      return {
        type: 'follow_up_record',
        id: null,
        name: row.name,
        current: { target_type: args.target_type, target_id: target.id, content: null },
      }
    }
    const row = await database.prepare(`SELECT f.id, f.content, target.${nameColumn} name
      FROM pms_follow_up_record f
      JOIN ${target.table} target ON target.id = f.${target.column} AND target.is_deleted = 0
      WHERE f.id = ? AND f.${target.column} = ? AND f.is_deleted = 0`)
      .get(args.follow_up_id, target.id)
    if (!row) throw businessValidationError('follow_up_id', '跟进记录不存在')
    return {
      type: 'follow_up_record',
      id: row.id,
      name: row.name,
      current: { target_type: args.target_type, target_id: target.id, content: row.content },
    }
  }
  if (name === 'business_attachment_upload' || name === 'business_attachment_delete') {
    if (!MAIN_TARGETS[args.business_type]) throw businessValidationError('business_type', '不支持该业务附件类型')
    const target = await loadMainTargetSnapshot(`${args.business_type}_update`, { id: args.business_id }, database)
    if (name === 'business_attachment_delete') {
      const attachment = await database.prepare(`SELECT id, original_name
        FROM pms_business_attachment
        WHERE id = ? AND business_type = ? AND business_id = ? AND is_deleted = 0`)
        .get(args.attachment_id, args.business_type, args.business_id)
      if (!attachment) throw businessValidationError('attachment_id', '附件不存在或不属于该业务数据')
      target.attachment = { id: attachment.id, name: attachment.original_name }
    }
    return target
  }
  const main = await loadMainTargetSnapshot(name, args, database)
  if (main) return main
  const reorder = await loadReorderTargetSnapshot(name, args, database)
  if (reorder) return reorder

  if (name === 'stage_create') {
    return loadOneTarget(database, {
      sql: 'SELECT id, name, status, owner_id FROM pms_project WHERE id = ? AND is_deleted = 0',
      params: [args.project_id],
      type: 'project',
      missingMessage: '项目不存在',
      currentFields: ['status', 'owner_id'],
    })
  }
  if (name === 'stage_update' || name === 'stage_delete') {
    return loadOneTarget(database, {
      sql: `SELECT s.id, s.name, s.sort_order, s.project_id, p.owner_id
        FROM pms_project_plan_stage s
        JOIN pms_project p ON p.id = s.project_id AND p.is_deleted = 0
        WHERE s.id = ? AND s.project_id = ? AND s.is_deleted = 0`,
      params: [args.stage_id, args.project_id],
      type: 'stage',
      missingMessage: '阶段不存在',
      currentFields: ['project_id', 'sort_order', 'owner_id'],
    })
  }
  if (name === 'stage_item_create' || name === 'stage_item_batch_create') {
    return loadOneTarget(database, {
      sql: `SELECT s.id, s.name, s.sort_order, s.project_id, p.owner_id
        FROM pms_project_plan_stage s
        JOIN pms_project p ON p.id = s.project_id AND p.is_deleted = 0
        WHERE s.id = ? AND s.project_id = ? AND s.is_deleted = 0`,
      params: [args.stage_id, args.project_id],
      type: 'stage',
      missingMessage: '阶段不存在',
      currentFields: ['project_id', 'sort_order', 'owner_id'],
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
      sql: 'SELECT id, name, status, owner_id FROM pms_project WHERE id = ? AND is_deleted = 0',
      params: [args.project_id],
      type: 'project',
      missingMessage: '项目不存在',
      currentFields: ['status', 'owner_id'],
    })
  }
  if (name === 'contract_update' || name === 'contract_delete' || name === 'contract_attachment_upload') {
    return loadOneTarget(database, {
      sql: `SELECT c.id, c.contract_name name, c.contract_code, c.contract_amount, c.project_id, p.owner_id
        FROM pms_project_contract c
        JOIN pms_project p ON p.id = c.project_id AND p.is_deleted = 0
        WHERE c.project_id = ? AND c.is_deleted = 0`,
      params: [args.project_id],
      type: 'contract',
      missingMessage: '项目合同不存在',
      currentFields: ['project_id', 'contract_code', 'contract_amount', 'owner_id'],
    })
  }
  if (name === 'contract_attachment_delete') {
    return loadOneTarget(database, {
      sql: `SELECT a.id, a.original_name name, a.file_size, c.project_id, p.owner_id
        FROM pms_project_contract_attachment a
        JOIN pms_project_contract c ON c.id = a.contract_id AND c.is_deleted = 0
        JOIN pms_project p ON p.id = c.project_id AND p.is_deleted = 0
        WHERE a.id = ? AND c.project_id = ? AND a.is_deleted = 0`,
      params: [args.attachment_id, args.project_id],
      type: 'contract_attachment',
      missingMessage: '合同附件不存在',
      currentFields: ['project_id', 'file_size', 'owner_id'],
    })
  }
  if (name === 'payment_create') {
    return loadOneTarget(database, {
      sql: `SELECT s.id, s.stage_name name, s.planned_amount, c.project_id, p.owner_id
        FROM pms_project_payment_stage s
        JOIN pms_project_contract c ON c.id = s.contract_id AND c.is_deleted = 0
        JOIN pms_project p ON p.id = c.project_id AND p.is_deleted = 0
        WHERE s.id = ? AND c.project_id = ? AND s.is_deleted = 0`,
      params: [args.stage_id, args.project_id],
      type: 'payment_stage',
      missingMessage: '付款阶段不存在',
      currentFields: ['project_id', 'planned_amount', 'owner_id'],
    })
  }
  if (name === 'payment_update' || name === 'payment_delete') {
    return loadOneTarget(database, {
      sql: `SELECT r.id, s.stage_name name, r.payment_amount, r.payment_month, r.handler_id, c.project_id, p.owner_id
        FROM pms_project_payment_record r
        JOIN pms_project_payment_stage s ON s.id = r.stage_id AND s.is_deleted = 0
        JOIN pms_project_contract c ON c.id = s.contract_id AND c.is_deleted = 0
        JOIN pms_project p ON p.id = c.project_id AND p.is_deleted = 0
        WHERE r.id = ? AND c.project_id = ? AND r.is_deleted = 0`,
      params: [args.payment_id, args.project_id],
      type: 'payment',
      missingMessage: '付款记录不存在',
      currentFields: ['project_id', 'payment_amount', 'payment_month', 'handler_id', 'owner_id'],
    })
  }
  if (name === 'stage_delivery_upload') {
    return loadOneTarget(database, {
      sql: `SELECT i.id, i.name, i.status, i.owner_id, s.project_id
        FROM pms_project_plan_item i
        JOIN pms_project_plan_stage s ON s.id = i.stage_id AND s.is_deleted = 0
        WHERE i.id = ? AND s.project_id = ? AND i.is_deleted = 0`,
      params: [args.item_id, args.project_id],
      type: 'stage_item',
      missingMessage: '关键事项不存在',
      currentFields: ['project_id', 'status', 'owner_id'],
    })
  }
  if (name === 'stage_delivery_delete') {
    return loadOneTarget(database, {
      sql: `SELECT f.id, f.original_name name, f.size_bytes, s.project_id, f.plan_item_id item_id, i.owner_id
        FROM pms_project_plan_delivery_file f
        JOIN pms_project_plan_item i ON i.id = f.plan_item_id AND i.is_deleted = 0
        JOIN pms_project_plan_stage s ON s.id = i.stage_id AND s.is_deleted = 0
        WHERE f.id = ? AND f.plan_item_id = ? AND s.project_id = ? AND f.is_current = 1 AND f.is_void = 0`,
      params: [args.file_id, args.item_id, args.project_id],
      type: 'stage_delivery',
      missingMessage: '交付文件不存在',
      currentFields: ['project_id', 'item_id', 'size_bytes', 'owner_id'],
    })
  }
  const error = new Error('操作目标类型不受支持')
  error.code = 'MCP_TOOL_NOT_SUPPORTED'
  throw error
}

function responsibleUserIds(type, current) {
  if (!current || typeof current !== 'object') return []
  if (type === 'task') return Array.isArray(current.owner_ids) ? current.owner_ids.map(Number) : []
  if (type === 'bug') return [Number(current.assignee_id)]
  if (type === 'work_order') return [Number(current.follower_id)]
  return [Number(current.owner_id)]
}

function ownershipError(message) {
  const error = new Error(message)
  error.code = 'MCP_ACTION_NOT_RESPONSIBLE'
  return error
}

function assertActionTargetOwnership(target, context, mode) {
  if (target.type === 'follow_up_record') return
  if (target.current === null) return
  const rows = target.type === 'stage_item_order' && Array.isArray(target.current?.order)
    ? target.current.order
    : Array.isArray(target.current)
    ? target.current
    : [{ id: target.id, name: target.name, ...target.current }]
  const userId = Number(context.user.id)
  const unauthorized = rows.filter((row) => !responsibleUserIds(target.type, row).includes(userId))
  if (!unauthorized.length) return
  const label = TARGET_LABELS[target.type] || '业务数据'
  const details = unauthorized
    .slice(0, 10)
    .map((row) => `#${row.id} ${row.name || ''}`.trim())
    .join('、')
  const overflow = unauthorized.length > 10 ? `等${unauthorized.length}条` : ''
  const prefix = mode === 'execute' ? '负责人已发生变化，' : ''
  throw ownershipError(`${prefix}只能操作本人负责的${label}；无权操作：${details}${overflow}`)
}

const actions = {
  product_create: [product.create, (a) => ({ body: cleanBody(a) })],
  product_update: [product.update, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  product_change_status: [product.toggleStatus, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  product_delete: [product.remove, (a) => ({ params: { id: id(a) } })],
  project_create: [project.create, (a) => ({ body: cleanBody(a) })],
  project_update: [project.update, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  project_change_priority: [project.updatePriority, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  project_change_status: [project.toggleStatus, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  project_delete: [project.remove, (a) => ({ params: { id: id(a) } })],
  requirement_create: [requirement.create, (a) => ({ body: cleanBody(a) })],
  requirement_update: [requirement.update, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  requirement_change_priority: [requirement.updatePriority, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  requirement_change_status: [requirement.toggleStatus, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  requirement_delete: [requirement.remove, (a) => ({ params: { id: id(a) } })],
  task_create: [task.create, (a) => ({ body: cleanBody(a) })],
  task_create_subtask: [task.createSubtask, (a) => ({ params: { id: id(a, 'parent_id') }, body: cleanBody(a) })],
  task_update: [task.update, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
  task_assign: [task.batchAssign, (a) => ({ body: cleanBody(a) })],
  task_change_priority: [task.updatePriority, (a) => ({ params: { id: id(a) }, body: cleanBody(a) })],
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
  stage_item_change_status: [stage.changeStatus, (a) => ({ params: { projectId: id(a, 'project_id'), itemId: id(a, 'item_id') }, body: cleanBody(a) })],
  stage_item_adjust: [stage.createAdjustment, (a) => ({ params: { projectId: id(a, 'project_id'), itemId: id(a, 'item_id') }, body: cleanBody(a) })],
  stage_item_delete: [stage.deleteItem, (a) => ({ params: { projectId: id(a, 'project_id'), itemId: id(a, 'item_id') } })],
  contract_create: [contract.create, (a) => ({ params: { id: id(a, 'project_id') }, body: cleanBody(a) })],
  contract_update: [contract.update, (a) => ({ params: { id: id(a, 'project_id') }, body: cleanBody(a) })],
  contract_delete: [contract.remove, (a) => ({ params: { id: id(a, 'project_id') } })],
  payment_create: [contract.createPayment, (a) => ({ params: { id: id(a, 'project_id'), stageId: id(a, 'stage_id') }, body: cleanBody(a) })],
  payment_update: [contract.updatePayment, (a) => ({ params: { id: id(a, 'project_id'), paymentId: id(a, 'payment_id') }, body: cleanBody(a) })],
  payment_delete: [contract.deletePayment, (a) => ({ params: { id: id(a, 'project_id'), paymentId: id(a, 'payment_id') } })],
  contract_attachment_upload: [contract.uploadAttachment, async (a) => ({ params: { id: id(a, 'project_id') }, file: await buildFileFromUrl(a) })],
  contract_attachment_delete: [contract.deleteAttachment, (a) => ({ params: { id: id(a, 'project_id'), attachmentId: id(a, 'attachment_id') } })],
  stage_delivery_upload: [stage.uploadFile, async (a) => ({ params: { projectId: id(a, 'project_id'), itemId: id(a, 'item_id') }, file: await buildFileFromUrl(a) })],
  stage_delivery_delete: [stage.deleteFile, (a) => ({ params: { projectId: id(a, 'project_id'), itemId: id(a, 'item_id'), fileId: id(a, 'file_id') } })],
  follow_up_record_create: [
    (req, res) => followUpRecord.forTarget(req.params.targetType).create(req, res),
    (a) => ({ params: { targetType: a.target_type, id: a.target_id }, body: { content: a.content } }),
  ],
  follow_up_record_update: [
    (req, res) => followUpRecord.forTarget(req.params.targetType).update(req, res),
    (a) => ({ params: { targetType: a.target_type, id: a.target_id, followUpId: a.follow_up_id }, body: { content: a.content } }),
  ],
  follow_up_record_delete: [
    (req, res) => followUpRecord.forTarget(req.params.targetType).remove(req, res),
    (a) => ({ params: { targetType: a.target_type, id: a.target_id, followUpId: a.follow_up_id } }),
  ],
  business_attachment_upload: [uploadBusinessAttachmentFromMcp, async (a) => ({
    params: { id: id(a, 'business_id') }, body: { business_type: a.business_type }, file: await buildFileFromUrl(a),
  })],
  business_attachment_delete: [deleteBusinessAttachmentFromMcp, (a) => ({
    params: { id: id(a, 'business_id'), attachmentId: id(a, 'attachment_id') }, body: { business_type: a.business_type },
  })],
}

function configuredFileOrigins() {
  return [
    OSS_FILE_ORIGIN,
    process.env.PUBLIC_APP_ORIGIN,
    process.env.ALLOWED_ORIGIN,
    ...String(process.env.MCP_FILE_URL_ALLOWED_ORIGINS || '').split(','),
  ]
    .filter(Boolean)
    .map((value) => value.trim())
    .map((value) => new URL(value).origin)
}

async function readLimitedBody(response, limit) {
  const reader = response.body?.getReader()
  if (!reader) throw businessValidationError('file_url', '文件URL未返回可读取内容')
  const chunks = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      throw businessValidationError('file_url', `文件过大（上限${limit}字节）`)
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks)
}

async function buildFileFromUrl(args, {
  allowedOrigins = configuredFileOrigins(),
  fetchImpl = fetch,
  limit = FILE_LIMIT,
} = {}) {
  if (!args.file_name) throw businessValidationError('file_name', '缺少文件名')
  if (!args.file_url) throw businessValidationError('file_url', '缺少文件URL')
  let url
  try {
    url = new URL(args.file_url)
  } catch {
    throw businessValidationError('file_url', '文件URL格式不正确')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw businessValidationError('file_url', '文件URL必须是无账号信息的HTTP或HTTPS地址')
  }
  const origins = allowedOrigins.map((value) => new URL(value).origin)
  if (!origins.includes(url.origin)) {
    throw businessValidationError('file_url', '文件URL不在允许的OSS地址范围内')
  }
  let response
  try {
    response = await fetchImpl(url, {
      signal: AbortSignal.timeout(10_000),
      redirect: 'manual',
    })
  } catch {
    throw businessValidationError('file_url', '读取文件URL失败')
  }
  if (response.status >= 300 && response.status < 400) {
    throw businessValidationError('file_url', '文件URL不允许重定向')
  }
  if (!response.ok) throw businessValidationError('file_url', `读取文件URL失败（HTTP ${response.status}）`)
  const declaredSize = Number(response.headers.get('content-length') || 0)
  if (declaredSize > limit) throw businessValidationError('file_url', `文件过大（上限${limit}字节）`)
  const buffer = await readLimitedBody(response, limit)
  if (!buffer.length) throw businessValidationError('file_url', '文件内容为空')
  return {
    originalname: args.file_name,
    mimetype: args.mime_type || response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream',
    size: buffer.length,
    buffer,
  }
}

async function validateRelatedUsers(args, database) {
  const scalarFields = ['owner_id', 'assignee_id', 'follower_id', 'handler_id']
  const arrayFields = ['owner_ids', 'member_ids', 'collaborator_ids']
  for (const field of scalarFields) {
    if (args[field] === undefined || args[field] === null || args[field] === '') continue
    const row = await database.prepare(
      'SELECT COUNT(*)::INTEGER count FROM pms_user WHERE id = ? AND status = 1 AND is_deleted = 0'
    ).get(Number(args[field]))
    if (Number(row?.count) !== 1) {
      throw businessValidationError(field, `${FIELD_USER_LABELS[field]}不存在或已停用`)
    }
  }
  for (const field of arrayFields) {
    if (!Array.isArray(args[field])) continue
    const ids = [...new Set(args[field].map(Number))]
    if (!ids.length) continue
    const row = await database.prepare(`SELECT COUNT(*)::INTEGER count FROM pms_user
      WHERE id IN (${ids.map(() => '?').join(',')}) AND status = 1 AND is_deleted = 0`).get(...ids)
    if (Number(row?.count) !== ids.length) {
      throw businessValidationError(field, `${FIELD_USER_LABELS[field]}中存在无效或停用用户`)
    }
  }
}

const FIELD_USER_LABELS = {
  owner_id: '负责人',
  assignee_id: '处理人',
  follower_id: '跟进人',
  handler_id: '经办人',
  owner_ids: '负责人',
  member_ids: '项目成员',
  collaborator_ids: '协作人',
}

const DUPLICATE_SPECS = {
  product_create: ['pms_product', 'name', 'name', '产品名称已存在'],
  product_update: ['pms_product', 'name', 'name', '产品名称已存在', 'id'],
  project_create: ['pms_project', 'name', 'name', '项目名称已存在'],
  project_update: ['pms_project', 'name', 'name', '项目名称已存在', 'id'],
  requirement_create: ['pms_requirement', 'title', 'title', '需求标题已存在'],
  requirement_update: ['pms_requirement', 'title', 'title', '需求标题已存在', 'id'],
  task_create: ['pms_task', 'name', 'name', '任务名称已存在'],
  task_create_subtask: ['pms_task', 'name', 'name', '任务名称已存在'],
  task_update: ['pms_task', 'name', 'name', '任务名称已存在', 'id'],
  bug_create: ['pms_bug', 'title', 'title', 'Bug标题已存在'],
  bug_update: ['pms_bug', 'title', 'title', 'Bug标题已存在', 'id'],
}

async function validateDuplicate(name, args, database) {
  const spec = DUPLICATE_SPECS[name]
  if (!spec) return
  const [table, column, field, message, excludeField] = spec
  if (!String(args[field] || '').trim()) return
  const params = [String(args[field]).trim()]
  let sql = `SELECT id FROM ${table} WHERE ${column} = ? AND is_deleted = 0`
  if (excludeField && args[excludeField]) {
    sql += ' AND id <> ?'
    params.push(Number(args[excludeField]))
  }
  if (await database.prepare(sql).get(...params)) throw businessValidationError(field, message)
}

async function validateProjectRequirement(name, args, database) {
  if (!['project_create', 'project_update'].includes(name)) return
  const requirement = await database.prepare(`SELECT r.id FROM pms_requirement r
    WHERE r.id = ? AND r.product_id = ? AND r.is_deleted = 0
      AND NOT EXISTS (
        SELECT 1 FROM pms_project p
        WHERE p.requirement_id = r.id AND p.is_deleted = 0 AND p.id <> ?
      )`).get(Number(args.requirement_id), Number(args.product_id), Number(args.id) || 0)
  if (!requirement) {
    throw businessValidationError('requirement_id', '所属需求不存在、不属于所选产品或已关联其他项目')
  }
}

async function validateStageDuplicates(name, args, database) {
  if (name === 'stage_create' || name === 'stage_update') {
    const stageName = String(args.name || '').trim()
    if (!stageName) return
    const params = [Number(args.project_id), stageName]
    let sql = 'SELECT id FROM pms_project_plan_stage WHERE project_id = ? AND name = ? AND is_deleted = 0'
    if (name === 'stage_update') {
      sql += ' AND id <> ?'
      params.push(Number(args.stage_id))
    }
    if (await database.prepare(sql).get(...params)) {
      throw businessValidationError('name', '阶段名称已存在')
    }
    return
  }

  if (!['stage_item_create', 'stage_item_update', 'stage_item_batch_create'].includes(name)) return
  const items = name === 'stage_item_batch_create' ? args.items || [] : [args]
  const names = new Set()
  for (const item of items) {
    const itemName = String(item.name || '').trim()
    if (names.has(itemName)) {
      throw businessValidationError('items', '本次新增存在同名关键事项')
    }
    names.add(itemName)
  }
  for (const [index, item] of items.entries()) {
    if (name === 'stage_item_batch_create') {
      try {
        await validateRelatedUsers(item, database)
      } catch (error) {
        if (error.code !== 'MCP_BUSINESS_VALIDATION') throw error
        throw businessValidationError('items', `第${index + 1}项：${Object.values(error.fieldErrors)[0]}`)
      }
    }
    const collaboratorIds = new Set((item.collaborator_ids || []).map(Number))
    if (item.owner_id && collaboratorIds.has(Number(item.owner_id))) {
      const field = name === 'stage_item_batch_create' ? 'items' : 'collaborator_ids'
      throw businessValidationError(field, name === 'stage_item_batch_create'
        ? `第${index + 1}项：协作人不能包含主负责人`
        : '协作人不能包含主负责人')
    }
    const itemName = String(item.name || '').trim()
    if (!itemName) continue
    const params = [Number(args.stage_id), itemName]
    let sql = 'SELECT id FROM pms_project_plan_item WHERE stage_id = ? AND name = ? AND is_deleted = 0'
    if (name === 'stage_item_update') {
      sql += ' AND id <> ?'
      params.push(Number(args.item_id))
    }
    if (await database.prepare(sql).get(...params)) {
      throw businessValidationError('name', '当前阶段已存在同名关键事项')
    }
  }
}

async function validateContractDuplicates(name, args, database) {
  if (!['contract_create', 'contract_update'].includes(name)) return
  const contractCode = String(args.contract_code || '').trim()
  if (contractCode) {
    const params = [contractCode]
    let sql = 'SELECT id FROM pms_project_contract WHERE contract_code = ? AND is_deleted = 0'
    if (name === 'contract_update') {
      sql += ' AND project_id <> ?'
      params.push(Number(args.project_id))
    }
    if (await database.prepare(sql).get(...params)) {
      throw businessValidationError('contract_code', '合同编码已存在')
    }
  }
  if (name === 'contract_create') {
    const existing = await database.prepare(
      'SELECT id FROM pms_project_contract WHERE project_id = ? AND is_deleted = 0'
    ).get(Number(args.project_id))
    if (existing) throw businessValidationError('project_id', '该项目已存在合同')
  }
}

async function validateDeleteBlockers(name, args, database) {
  if (name === 'product_delete') {
    const counts = await database.prepare(`SELECT
      (SELECT COUNT(*) FROM pms_project WHERE product_id = ? AND is_deleted = 0)::INTEGER project_count,
      (SELECT COUNT(*) FROM pms_work_order WHERE product_id = ? AND is_deleted = 0)::INTEGER work_order_count`)
      .get(args.id, args.id)
    if (Number(counts?.project_count) || Number(counts?.work_order_count)) {
      throw businessValidationError('id', '该产品已被项目或运维工单引用，无法删除')
    }
  }
  if (name === 'project_delete') {
    const counts = await database.prepare(`SELECT
      (SELECT COUNT(*) FROM pms_task WHERE project_id = ? AND is_deleted = 0)::INTEGER task_count,
      (SELECT COUNT(*) FROM pms_bug WHERE project_id = ? AND is_deleted = 0)::INTEGER bug_count,
      (SELECT COUNT(*) FROM pms_project_contract WHERE project_id = ? AND is_deleted = 0)::INTEGER contract_count`)
      .get(args.id, args.id, args.id)
    if (Number(counts?.task_count) || Number(counts?.bug_count) || Number(counts?.contract_count)) {
      throw businessValidationError('id', '该项目仍有关联任务、BUG或合同，无法删除')
    }
  }
  if (name === 'requirement_delete') {
    const counts = await database.prepare(`SELECT
      (SELECT COUNT(*) FROM pms_task WHERE requirement_id = ? AND is_deleted = 0)::INTEGER task_count,
      (SELECT COUNT(*) FROM pms_bug WHERE requirement_id = ? AND is_deleted = 0)::INTEGER bug_count`)
      .get(args.id, args.id)
    if (Number(counts?.task_count) || Number(counts?.bug_count)) {
      throw businessValidationError('id', '该需求仍有关联任务或BUG，无法删除')
    }
  }
  if (name === 'task_delete') {
    const row = await database.prepare(
      'SELECT COUNT(*)::INTEGER count FROM pms_task WHERE parent_task_id = ? AND is_deleted = 0'
    ).get(args.id)
    if (Number(row?.count)) throw businessValidationError('id', `该主任务下还有 ${row.count} 个子任务，不能删除`)
  }
  if (name === 'stage_delete') {
    const row = await database.prepare(
      'SELECT COUNT(*)::INTEGER count FROM pms_project_plan_item WHERE stage_id = ? AND is_deleted = 0'
    ).get(args.stage_id)
    if (Number(row?.count)) throw businessValidationError('stage_id', '阶段下存在关键事项，不能删除')
  }
}

async function validateContractUpdatePayments(args, database) {
  const rows = await database.prepare(`SELECT c.id contract_id, s.id, s.stage_name,
    COALESCE(SUM(r.payment_amount) FILTER (WHERE r.is_deleted = 0), 0) paid_amount
    FROM pms_project_contract c
    LEFT JOIN pms_project_payment_stage s ON s.contract_id = c.id AND s.is_deleted = 0
    LEFT JOIN pms_project_payment_record r ON r.stage_id = s.id
    WHERE c.project_id = ? AND c.is_deleted = 0
    GROUP BY c.id, s.id, s.stage_name`).all(args.project_id)
  if (!rows.length) throw businessValidationError('project_id', '项目合同不存在')
  const existing = new Map(rows.filter((row) => row.id !== null).map((row) => [String(row.id), row]))
  const requestedIds = new Set()
  for (const item of args.stages || []) {
    if (item.id === undefined || item.id === null) continue
    const current = existing.get(String(item.id))
    if (!current) throw businessValidationError('stages', '付款阶段不属于当前合同')
    requestedIds.add(String(item.id))
    if (Number(item.planned_amount) < Number(current.paid_amount)) {
      throw businessValidationError('stages', `付款阶段“${current.stage_name}”的计划金额不能小于已付金额`)
    }
  }
  for (const current of existing.values()) {
    if (!requestedIds.has(String(current.id)) && Number(current.paid_amount) > 0) {
      throw businessValidationError('stages', `已有付款记录的阶段“${current.stage_name}”不能删除`)
    }
  }
}

async function validateFileActionLimits(name, args, database) {
  if (name === 'contract_attachment_upload') {
    const row = await database.prepare(`SELECT COUNT(a.id)::INTEGER count
      FROM pms_project_contract c
      LEFT JOIN pms_project_contract_attachment a
        ON a.contract_id = c.id AND a.is_deleted = 0
      WHERE c.project_id = ? AND c.is_deleted = 0`).get(args.project_id)
    if (Number(row?.count) >= 10) {
      throw businessValidationError('file_name', '一份合同最多上传10个附件')
    }
  }
  if (name === 'stage_delivery_delete') {
    const row = await database.prepare(`SELECT i.status, i.requires_delivery_file,
      (SELECT COUNT(*) FROM pms_project_plan_delivery_file f
        WHERE f.plan_item_id = i.id AND f.is_current = 1 AND f.is_void = 0)::INTEGER active_file_count
      FROM pms_project_plan_item i
      JOIN pms_project_plan_stage s ON s.id = i.stage_id AND s.is_deleted = 0
      WHERE i.id = ? AND s.project_id = ? AND i.is_deleted = 0`).get(args.item_id, args.project_id)
    if (Number(row?.status) === 2 && Number(row?.requires_delivery_file) === 1
      && Number(row?.active_file_count) <= 1) {
      throw businessValidationError('file_id', '已完成且要求交付文件的事项必须至少保留一个有效文件')
    }
  }
}

async function validateActionBusinessRules(name, args, database = db) {
  if (['follow_up_record_create', 'follow_up_record_update'].includes(name)) {
    try {
      normalizeFollowUpContent(args.content)
    } catch (error) {
      throw businessValidationError('content', error.message)
    }
  }
  await validateFileActionLimits(name, args, database)
  if (name.endsWith('_upload')) {
    try {
      validateAttachmentFile(await buildFileFromUrl(args))
    } catch (error) {
      if (error.code === 'MCP_BUSINESS_VALIDATION') throw error
      throw businessValidationError(
        /文件名/.test(error.message) ? 'file_name' : 'file_url',
        error.message
      )
    }
  }
  if (name === 'contract_create' || name === 'contract_update') {
    const stageError = validateContractStages(args.contract_amount, args.stages)
    if (stageError) {
      throw businessValidationError(
        stageError.startsWith('合同金额') ? 'contract_amount' : 'stages',
        stageError
      )
    }
    if (name === 'contract_update') await validateContractUpdatePayments(args, database)
  }
  await validateRelatedUsers(args, database)
  if (args.product_id !== undefined && ['project_create', 'project_update', 'requirement_create', 'requirement_update', 'work_order_create', 'work_order_update'].includes(name)) {
    const product = await database.prepare(
      'SELECT id FROM pms_product WHERE id = ? AND status = 1 AND is_deleted = 0'
    ).get(Number(args.product_id))
    if (!product) throw businessValidationError('product_id', '所属产品不存在或已停用')
  }
  await validateProjectRequirement(name, args, database)
  if (['task_create', 'task_update', 'bug_create', 'bug_update'].includes(name)) {
    if (Number(args.source_type) === 1) {
      const project = await database.prepare(
        'SELECT id FROM pms_project WHERE id = ? AND is_deleted = 0'
      ).get(Number(args.project_id))
      if (!project) throw businessValidationError('project_id', '关联项目不存在或已删除')
    }
    if (Number(args.source_type) === 2) {
      const requirement = await database.prepare(
        'SELECT id FROM pms_requirement WHERE id = ? AND is_deleted = 0'
      ).get(Number(args.requirement_id))
      if (!requirement) throw businessValidationError('requirement_id', '关联需求不存在或已删除')
    }
  }
  const archiveReferences = [
    ['task_type', '任务类型'],
    ['bug_type_id', 'Bug类型'],
    ['problem_type', '问题类型'],
    ['supplier_id', '供应商'],
  ]
  for (const [field, typeName] of archiveReferences) {
    if (args[field] === undefined || args[field] === null || args[field] === '') continue
    const archive = await database.prepare(`SELECT a.id FROM pms_archive a
      JOIN pms_archive_type t ON t.id = a.archive_type_id
      WHERE a.id = ? AND a.status = 1 AND a.is_deleted = 0
        AND t.name = ? AND t.status = 1 AND t.is_deleted = 0`).get(Number(args[field]), typeName)
    if (!archive) throw businessValidationError(field, `${typeName}不存在或已停用`)
  }
  if (name.startsWith('payment_') && args.payment_month !== undefined
    && !normalizePaymentMonth(args.payment_month)) {
    throw businessValidationError('payment_month', '付款月份无效，必须使用YYYY-MM且不能晚于当前月份')
  }
  if (['payment_create', 'payment_update'].includes(name) && args.payment_amount !== undefined) {
    const payment = await database.prepare(`SELECT s.planned_amount,
      COALESCE(SUM(r.payment_amount) FILTER (WHERE r.is_deleted = 0 AND (?::BIGINT IS NULL OR r.id <> ?)), 0) paid_amount
      FROM pms_project_payment_stage s
      LEFT JOIN pms_project_payment_record r ON r.stage_id = s.id
      WHERE s.id = COALESCE(
        ?::BIGINT,
        (SELECT stage_id FROM pms_project_payment_record
          WHERE id = ? AND is_deleted = 0)
      ) AND s.is_deleted = 0
      GROUP BY s.id`).get(
      args.payment_id || null,
      args.payment_id || null,
      args.stage_id || null,
      args.payment_id || null
    )
    if (payment) {
      const unpaid = Number(payment.planned_amount) - Number(payment.paid_amount)
      const amountError = validatePaymentAmount(args.payment_amount, unpaid)
      if (amountError) throw businessValidationError('payment_amount', amountError)
    }
  }
  await validateStageDuplicates(name, args, database)
  await validateContractDuplicates(name, args, database)
  await validateDuplicate(name, args, database)
  await validateDeleteBlockers(name, args, database)
}

async function dispatchActionTool(name, args, context, dependencies = {}) {
  const actionDefinitions = dependencies.actions || actions
  const actionTicketService = dependencies.ticketService || ticketService
  const loadTarget = dependencies.loadTarget || loadActionTargetSnapshot
  const database = dependencies.database || db
  const mergeArguments = dependencies.mergeArguments || mergeActionUpdateArguments
  const validateStatus = dependencies.validateStatus || validateStatusAction
  const validateBusinessRules = dependencies.validateBusinessRules || validateActionBusinessRules
  const definition = actionDefinitions[name]
  if (!definition) {
    const error = new Error('操作工具不存在或当前账号无权限')
    error.code = 'MCP_TOOL_NOT_FOUND'
    throw error
  }
  if (args.mode === undefined || args.mode === null || args.mode === '') {
    throw businessValidationError('mode', 'mode必须显式传递preview或execute')
  }
  const mode = args.mode
  if (!['preview', 'execute'].includes(mode)) throw businessValidationError('mode', 'mode必须是preview或execute')
  if (name === 'business_attachment_upload' || name === 'business_attachment_delete') {
    const menuByType = {
      requirement: '/requirements', project: '/projects', task: '/tasks', bug: '/bugs', work_order: '/work-orders',
    }
    const menuPath = menuByType[args.business_type]
    if (!menuPath || !context.allowedMenuPaths.has(menuPath)) {
      const error = new Error('当前账号没有该业务模块权限')
      error.code = 'MCP_PERMISSION_DENIED'
      throw error
    }
  }
  validateActionActualDates(args)
  const preparedArgs = await mergeArguments(name, args, database)
  await validateStatus(name, preparedArgs, database)
  await validateBusinessRules(name, preparedArgs, database)
  const riskLevel = highRiskPattern.test(name) ? 'high' : 'medium'
  const riskReason = riskLevel === 'high'
    ? '该操作会删除、变更状态或优先级、调整顺序、处理金额、批量处理或变更文件'
    : '该操作会新增或修改PMIS业务数据'
  const target = await loadTarget(name, preparedArgs, database)
  const affectedTargets = [target]
  assertActionTargetOwnership(target, context, mode)
  if (mode === 'preview') {
    const preview = {
      tool: name,
      riskLevel,
      operator: { employeeNo: context.user.employeeNo, realName: context.user.realName },
      target,
      changes: buildPreviewChanges(args),
    }
    const ticket = await actionTicketService.createTicket(context, name, preparedArgs, preview, riskLevel)
    return {
      ...ticket,
      riskLevel,
      riskReason,
      requiresConfirmation: true,
      executed: false,
      affectedTargets,
      resultStatus: 'preview',
      executeArguments: {
        ...preparedArgs,
        mode: 'execute',
        confirmation_id: ticket.confirmationId,
      },
    }
  }
  await actionTicketService.consumeTicket(context, name, preparedArgs, args.confirmation_id)
  try {
    const [handler, buildInput] = definition
    const data = unwrapEnvelope(await invokeController(handler, context, await buildInput(preparedArgs)))
    const verification = await verifyActionResult(name, preparedArgs, database)
    return {
      success: true,
      outcome: 'executed',
      message: verification ? '操作已成功执行并通过结果校验' : '操作已成功执行',
      tool: name,
      riskLevel,
      riskReason,
      requiresConfirmation: false,
      executed: true,
      target,
      affectedTargets,
      changes: buildPreviewChanges(args),
      resultStatus: 'success',
      businessResult: data,
      data,
      ...(verification ? { verification } : {}),
    }
  } catch (error) {
    await actionTicketService.markTicketFailed(args.confirmation_id).catch(() => {})
    throw error
  }
}

async function verifyActionResult(name, args, database = db) {
  if (name !== 'business_attachment_delete') return null

  const attachmentId = Number(args.attachment_id)
  const businessId = Number(args.business_id)
  const businessType = args.business_type
  const row = await database.prepare(`
    SELECT is_deleted
    FROM pms_business_attachment
    WHERE id = ? AND business_type = ? AND business_id = ?
  `).get(attachmentId, businessType, businessId)
  const active = Boolean(row && Number(row.is_deleted) === 0)

  if (active) {
    const error = new Error('附件删除后校验失败，附件仍然存在')
    error.code = 'MCP_RESULT_VERIFICATION_FAILED'
    throw error
  }

  return {
    verified: true,
    type: 'attachment_deleted',
    businessType,
    businessId,
    attachmentId,
    active: false,
  }
}

module.exports = {
  actions,
  assertActionTargetOwnership,
  buildFileFromUrl,
  dispatchActionTool,
  loadActionTargetSnapshot,
  mergeActionUpdateArguments,
  validateActionBusinessRules,
  validateStatusAction,
}
