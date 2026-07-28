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
const { allowedProjectStatuses, validateProjectStatusChange } = require('../services/productProjectRules')
const { allowedRequirementStatuses, validateRequirementStatusChange } = require('../services/requirementRules')
const { allowedTaskStatuses, validateTaskStatusChange, canCompleteParent, canLeaveCompletedSubtask } = require('../services/taskRules')
const { allowedBugStatuses, validateBugStatusChange } = require('../services/bugRules')
const { allowedWorkOrderStatuses, resolveWorkOrderResultFields, validateWorkOrderResultFields } = require('../services/workOrderStatusRules')
const { allowedPlanItemStatuses, validatePlanItemStatusChange } = require('../services/projectStagePlanRules')
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

function businessValidationError(field, message) {
  const error = new Error(message)
  error.code = 'MCP_BUSINESS_VALIDATION'
  error.fieldErrors = { [field]: message }
  return error
}

function preserveOmittedFields(args, row, fields) {
  const merged = { ...args }
  for (const field of fields) {
    if (merged[field] === undefined) merged[field] = row[field] ?? null
  }
  return merged
}

const UPDATE_SPECS = {
  product_update: {
    sql: 'SELECT description FROM pms_product WHERE id = ? AND is_deleted = 0',
    params: (args) => [args.id],
    fields: ['description'],
  },
  project_update: {
    sql: 'SELECT description, start_date, progress_text, risk_text FROM pms_project WHERE id = ? AND is_deleted = 0',
    params: (args) => [args.id],
    fields: ['description', 'start_date', 'progress_text', 'risk_text'],
    relationship: {
      field: 'member_ids',
      sql: 'SELECT user_id id FROM pms_project_member WHERE project_id = ? ORDER BY user_id',
      params: (args) => [args.id],
    },
  },
  requirement_update: {
    sql: `SELECT description, project_id, priority, submitter_dept, start_date, expected_end_date
      FROM pms_requirement WHERE id = ? AND is_deleted = 0`,
    params: (args) => [args.id],
    fields: ['description', 'project_id', 'priority', 'submitter_dept', 'start_date', 'expected_end_date'],
  },
  task_update: {
    sql: `SELECT description, project_id, requirement_id, priority, start_date, expected_end_date
      FROM pms_task WHERE id = ? AND is_deleted = 0`,
    params: (args) => [args.id],
    fields: ['description', 'project_id', 'requirement_id', 'priority', 'start_date', 'expected_end_date'],
    relationship: {
      field: 'owner_ids',
      sql: 'SELECT user_id id FROM pms_task_owner WHERE task_id = ? ORDER BY sort_order, user_id',
      params: (args) => [args.id],
    },
  },
  bug_update: {
    sql: 'SELECT description, project_id, requirement_id FROM pms_bug WHERE id = ? AND is_deleted = 0',
    params: (args) => [args.id],
    fields: ['description', 'project_id', 'requirement_id'],
  },
  stage_update: {
    sql: `SELECT s.description FROM pms_project_plan_stage s
      WHERE s.id = ? AND s.project_id = ? AND s.is_deleted = 0`,
    params: (args) => [args.stage_id, args.project_id],
    fields: ['description'],
  },
  stage_item_update: {
    sql: `SELECT i.requires_delivery_file, i.remark FROM pms_project_plan_item i
      JOIN pms_project_plan_stage s ON s.id = i.stage_id AND s.is_deleted = 0
      WHERE i.id = ? AND s.project_id = ? AND i.is_deleted = 0`,
    params: (args) => [args.item_id, args.project_id],
    fields: ['requires_delivery_file', 'remark'],
    relationship: {
      field: 'collaborator_ids',
      sql: 'SELECT user_id id FROM pms_project_plan_item_collaborator WHERE plan_item_id = ? ORDER BY sort_order, user_id',
      params: (args) => [args.item_id],
    },
  },
  contract_update: {
    sql: 'SELECT remark FROM pms_project_contract WHERE project_id = ? AND is_deleted = 0',
    params: (args) => [args.project_id],
    fields: ['remark'],
  },
  payment_update: {
    sql: `SELECT r.remark FROM pms_project_payment_record r
      JOIN pms_project_payment_stage s ON s.id = r.stage_id AND s.is_deleted = 0
      JOIN pms_project_contract c ON c.id = s.contract_id AND c.is_deleted = 0
      WHERE r.id = ? AND c.project_id = ? AND r.is_deleted = 0`,
    params: (args) => [args.payment_id, args.project_id],
    fields: ['remark'],
  },
}

async function mergeActionUpdateArguments(name, args, database = db) {
  const spec = UPDATE_SPECS[name]
  if (!spec) return { ...args }
  const row = await database.prepare(spec.sql).get(...spec.params(args))
  if (!row) return { ...args }
  const merged = preserveOmittedFields(args, row, spec.fields)
  if (spec.relationship && merged[spec.relationship.field] === undefined) {
    const rows = await database.prepare(spec.relationship.sql).all(...spec.relationship.params(args))
    merged[spec.relationship.field] = rows.map((item) => Number(item.id))
  }
  return merged
}

async function statusRow(database, sql, params, field, missingMessage) {
  const row = await database.prepare(sql).get(...params)
  if (!row) throw businessValidationError(field, missingMessage)
  return row
}

function rejectTransition(label) {
  throw businessValidationError('status', `当前${label}状态不允许变更为目标状态`)
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
    if (!allowedProjectStatuses(row.status).includes(target)) rejectTransition('项目')
    const message = validateProjectStatusChange(target, args)
    if (message) throw businessValidationError(target === 2 ? 'actual_end_date' : 'suspend_date', message)
    return
  }

  if (name === 'requirement_change_status') {
    const row = await statusRow(database, 'SELECT status, requirement_type FROM pms_requirement WHERE id = ? AND is_deleted = 0', [args.id], 'id', '需求不存在')
    if (!allowedRequirementStatuses(row.requirement_type, row.status).includes(target)) rejectTransition('需求')
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
    if (!allowedTaskStatuses(row.status, row.previous_status).includes(target)) rejectTransition('任务')
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
    if (!allowedBugStatuses(row.status).includes(target)) rejectTransition('BUG')
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
    if (!allowedWorkOrderStatuses(row.status).includes(target)) rejectTransition('工单')
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
    if (!allowedPlanItemStatuses(row.status, row.previous_status).includes(target)) rejectTransition('关键事项')
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
    if (ids.some((value) => !Number.isInteger(value) || value <= 0)) {
      throw new Error(`${label}标识不合法`)
    }
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
  stage_item_change_status: [stage.changeStatus, (a) => ({ params: { projectId: id(a, 'project_id'), itemId: id(a, 'item_id') }, body: cleanBody(a) })],
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

async function dispatchActionTool(name, args, context, dependencies = {}) {
  const actionDefinitions = dependencies.actions || actions
  const actionTicketService = dependencies.ticketService || ticketService
  const loadTarget = dependencies.loadTarget || loadActionTargetSnapshot
  const database = dependencies.database || db
  const mergeArguments = dependencies.mergeArguments || mergeActionUpdateArguments
  const definition = actionDefinitions[name]
  if (!definition) throw new Error('操作工具不存在或无权限')
  const mode = args.mode || 'preview'
  if (!['preview', 'execute'].includes(mode)) throw new Error('mode必须是preview或execute')
  const preparedArgs = await mergeArguments(name, args, database)
  await validateStatusAction(name, preparedArgs, database)
  const riskLevel = highRiskPattern.test(name) ? 'high' : 'medium'
  if (mode === 'preview') {
    const target = await loadTarget(name, preparedArgs, database)
    const preview = {
      tool: name,
      riskLevel,
      operator: { employeeNo: context.user.employeeNo, realName: context.user.realName },
      target,
      changes: buildPreviewChanges(args),
    }
    return actionTicketService.createTicket(context, name, preparedArgs, preview, riskLevel)
  }
  await actionTicketService.consumeTicket(context, name, preparedArgs, args.confirmation_id)
  try {
    const [handler, buildInput] = definition
    return unwrapEnvelope(await invokeController(handler, context, buildInput(preparedArgs)))
  } catch (error) {
    await actionTicketService.markTicketFailed(args.confirmation_id).catch(() => {})
    throw error
  }
}

module.exports = {
  actions,
  dispatchActionTool,
  loadActionTargetSnapshot,
  mergeActionUpdateArguments,
  validateStatusAction,
}
