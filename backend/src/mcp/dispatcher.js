const {
  getCommandDefinition,
  getPublicToolDefinition,
  OPTION_MENU_PATHS,
  resolvePublicTool,
} = require('./catalog')
const { dispatchQueryTool } = require('./queryTools')
const { dispatchActionTool } = require('./actionTools')
const { recordMcpAudit } = require('../services/mcpAuditService')
const { normalizeSortField } = require('./sortFields')

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

const FOLLOW_UP_TARGET_MENU_PATHS = {
  project: '/projects',
  requirement: '/requirements',
  task: '/tasks',
}

const AUDIT_MODULES = {
  product: '产品',
  project: '项目',
  requirement: '需求',
  task: '任务',
  bug: 'BUG',
  work_order: '工单',
  stage_item: '阶段关键事项',
  stage: '项目阶段',
  contract_attachment: '合同附件',
  contract: '项目合同',
  payment: '付款记录',
  stage_delivery: '交付文件',
  follow_up_record: '跟进记录',
}

function auditModule(commandName) {
  return Object.keys(AUDIT_MODULES)
    .sort((a, b) => b.length - a.length)
    .find((prefix) => commandName === prefix || commandName.startsWith(`${prefix}_`))
}

function buildAuditSummary(commandName, args = {}, result) {
  const target = Array.isArray(result?.affectedTargets) ? result.affectedTargets[0] : null
  const type = target?.type || auditModule(commandName)
  const fallbackId = commandName.startsWith('payment_')
    ? args.payment_id || args.stage_id
    : commandName.startsWith('contract_attachment_')
      ? args.attachment_id
      : commandName.startsWith('stage_delivery_')
        ? args.file_id || args.item_id
        : commandName.startsWith('stage_item_')
          ? args.item_id
          : commandName.startsWith('stage_')
            ? args.stage_id
            : args.id || args.project_id
  const affectedCount = Array.isArray(result?.affectedTargets)
    ? result.affectedTargets.reduce((count, item) => count + (Array.isArray(item.ids) ? item.ids.length : 1), 0)
    : null
  return {
    module: AUDIT_MODULES[type] || type || null,
    targetId: target?.id ?? fallbackId ?? null,
    targetName: target?.name || null,
    riskLevel: result?.riskLevel || null,
    resultCount: affectedCount ?? resultCount(result),
  }
}

function resultCount(result) {
  if (Array.isArray(result)) return result.length
  if (Array.isArray(result?.items)) return result.items.length
  if (Array.isArray(result?.list)) return result.list.length
  if (Array.isArray(result?.results)) return result.results.length
  return null
}

function matchesJsonType(type, value) {
  if (type === 'null') return value === null
  if (type === 'array') return Array.isArray(value)
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value)
  if (type === 'integer') return Number.isInteger(value)
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
  return typeof value === type
}

function argumentError(field, message) {
  const error = new Error(message)
  error.code = 'MCP_ARGUMENT_INVALID'
  if (field) error.fieldErrors = { [field]: message }
  return error
}

function argumentErrors(fieldErrors, message) {
  const error = new Error(message || Object.values(fieldErrors).join('；') || '工具参数校验失败')
  error.code = 'MCP_ARGUMENT_INVALID'
  error.fieldErrors = fieldErrors
  return error
}

function isRealDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

const UNKNOWN_FIELD_ALIASES = {
  priorityName: 'priority',
  finishDat: 'expected_end_date',
  finishDate: 'expected_end_date',
}
const READ_ONLY_FIELDS = new Set([
  'creatorId', 'creator_id', 'updaterId', 'updater_id', 'createdAt', 'created_at', 'updatedAt', 'updated_at',
])

function unknownFieldMessage(field, allowed) {
  if (READ_ONLY_FIELDS.has(field)) return `${field}是只读字段，不允许修改`
  const alias = UNKNOWN_FIELD_ALIASES[field]
  if (alias && allowed.has(alias)) return `不支持的参数：${field}；请使用 ${alias}`
  return `不支持的参数：${field}`
}

function missingArgumentsError(schema, fields, prefix = '') {
  const fieldErrors = Object.fromEntries(fields.map((field) => {
    const path = prefix ? `${prefix}.${field}` : field
    const label = fieldLabel(schema.properties?.[field], path)
    return [path, `${label}为必填项`]
  }))
  const message = `缺少参数：${fields.map((field) => prefix ? `${prefix}.${field}` : field).join('、')}`
  const error = new Error(message)
  error.code = 'MCP_ARGUMENT_INVALID'
  error.fieldErrors = fieldErrors
  return error
}

function fieldLabel(schema, path) {
  const description = String(schema?.description || '').split(/[：；，,]/)[0].trim()
  return description && description.length <= 20 ? description : path
}

function validateSchemaValue(schema, value, path) {
  const types = Array.isArray(schema?.type) ? schema.type : schema?.type ? [schema.type] : []
  if (types.length && !types.some((type) => matchesJsonType(type, value))) {
    throw argumentError(path, `${path}参数类型不合法（${fieldLabel(schema, path)}类型不正确）`)
  }
  if (schema?.enum && !schema.enum.includes(value)) {
    const mapping = String(schema.description || '').split('：').slice(1).join('：').trim()
    throw argumentError(path, mapping
      ? `${fieldLabel(schema, path)}必须是：${mapping}`
      : `${fieldLabel(schema, path)}可选值为：${schema.enum.join('、')}`)
  }
  if (schema?.const !== undefined && value !== schema.const) {
    throw argumentError(path, `${fieldLabel(schema, path)}必须为${schema.const}`)
  }
  if (schema?.format === 'uuid' && typeof value === 'string'
    && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw argumentError(path, `${path}格式不合法（${fieldLabel(schema, path)}必须是有效的UUID）`)
  }
  if (schema?.format === 'date' && typeof value === 'string'
    && !isRealDate(value)) {
    throw argumentError(path, `${fieldLabel(schema, path)}必须是真实存在的日期，格式为YYYY-MM-DD`)
  }
  if (schema?.format === 'date-or-date-time' && typeof value === 'string') {
    const dateTimePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/
    if (!isRealDate(value) && (!dateTimePattern.test(value) || Number.isNaN(Date.parse(value)))) {
      throw argumentError(path, `${fieldLabel(schema, path)}必须是有效的YYYY-MM-DD日期或ISO 8601日期时间`)
    }
  }
  if (schema?.pattern && typeof value === 'string' && !(new RegExp(schema.pattern).test(value))) {
    throw argumentError(path, `${fieldLabel(schema, path)}格式不正确`)
  }
  if (schema?.maxLength && typeof value === 'string' && value.length > schema.maxLength) {
    throw argumentError(path, `${fieldLabel(schema, path)}长度不能超过${schema.maxLength}个字符`)
  }
  if (schema?.minLength && typeof value === 'string' && value.length < schema.minLength) {
    throw argumentError(path, `${fieldLabel(schema, path)}不能为空`)
  }
  if (schema?.minItems && Array.isArray(value) && value.length < schema.minItems) {
    throw argumentError(path, `${path}参数数量不足（${fieldLabel(schema, path)}至少需要${schema.minItems}项）`)
  }
  if (schema?.maxItems && Array.isArray(value) && value.length > schema.maxItems) {
    throw argumentError(path, `${path}参数数量过多（${fieldLabel(schema, path)}最多允许${schema.maxItems}项）`)
  }
  if (schema?.minimum !== undefined && typeof value === 'number' && value < schema.minimum) {
    throw argumentError(path, `${fieldLabel(schema, path)}不能小于${schema.minimum}`)
  }
  if (schema?.maximum !== undefined && typeof value === 'number' && value > schema.maximum) {
    throw argumentError(path, `${fieldLabel(schema, path)}不能大于${schema.maximum}`)
  }
  if (schema?.exclusiveMinimum !== undefined && typeof value === 'number' && value <= schema.exclusiveMinimum) {
    throw argumentError(path, `${fieldLabel(schema, path)}必须大于${schema.exclusiveMinimum}`)
  }
  if (schema?.multipleOf !== undefined && typeof value === 'number') {
    const quotient = value / schema.multipleOf
    if (Math.abs(quotient - Math.round(quotient)) > 1e-8) {
      throw argumentError(path, `${fieldLabel(schema, path)}最多保留两位小数`)
    }
  }
  if (Array.isArray(value) && schema?.items) {
    value.forEach((item, index) => validateSchemaValue(schema.items, item, `${path}[${index}]`))
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema?.properties || {}
    const required = schema?.required || []
    const missing = required.filter((key) => value[key] === undefined || value[key] === null || value[key] === '')
    if (missing.length) throw missingArgumentsError(schema, missing, path)
    for (const [key, childValue] of Object.entries(value)) {
      const childSchema = properties[key] || (schema?.additionalProperties && schema.additionalProperties !== true
        ? schema.additionalProperties
        : null)
      if (childSchema) validateSchemaValue(childSchema, childValue, `${path}.${key}`)
      else if (schema?.additionalProperties === false) throw argumentError(`${path}.${key}`, `不支持的参数：${path}.${key}`)
    }
  }
}

function conditionMatches(condition, args) {
  if (!condition) return false
  if ((condition.required || []).some((field) => args[field] === undefined || args[field] === null || args[field] === '')) {
    return false
  }
  return Object.entries(condition.properties || {}).every(([field, schema]) => {
    if (schema.const !== undefined) return args[field] === schema.const
    if (schema.enum) return schema.enum.includes(args[field])
    return true
  })
}

function selectedInputSchema(schema, args) {
  const branch = (schema.oneOf || []).find((candidate) => Object.entries(candidate.properties || {})
    .some(([field, property]) => property.const !== undefined && args[field] === property.const))
  if (!branch) return schema
  return {
    ...schema,
    ...branch,
    properties: { ...(schema.properties || {}), ...(branch.properties || {}) },
    oneOf: undefined,
  }
}

function validateToolArguments(definition, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw argumentError(null, '工具参数必须是对象')
  const schema = selectedInputSchema(definition.inputSchema || {}, args)
  const allowed = new Set(Object.keys(schema.properties || {}))
  const unknown = Object.keys(args).filter((key) => !allowed.has(key))
  if (unknown.length) {
    throw argumentErrors(
      Object.fromEntries(unknown.map((field) => [field, unknownFieldMessage(field, allowed)])),
      `不支持的参数：${unknown.join('、')}`
    )
  }
  const missing = (schema.required || []).filter((key) => args[key] === undefined || args[key] === null || args[key] === '')
  if (missing.length) throw missingArgumentsError(schema, missing)
  for (const rule of schema.allOf || []) {
    if (!conditionMatches(rule.if, args)) continue
    const conditionalMissing = (rule.then?.required || [])
      .filter((key) => args[key] === undefined || args[key] === null || args[key] === '')
    if (definition._meta?.requiresSourceTarget
      && conditionalMissing.every((field) => ['project_id', 'requirement_id'].includes(field))) {
      continue
    }
    if (conditionalMissing.length) throw missingArgumentsError(schema, conditionalMissing)
  }
  const fieldErrors = {}
  const validationMessages = []
  for (const [key, value] of Object.entries(args)) {
    const property = schema.properties?.[key]
    if (property) {
      try {
        validateSchemaValue(property, value, key)
      } catch (error) {
        Object.assign(fieldErrors, error.fieldErrors || { [key]: error.message })
        validationMessages.push(error.message)
      }
    }
  }
  const datePairs = [
    ['start_date', 'expected_end_date', '计划开始日期', '预计完成日期'],
    ['date_from', 'date_to', '开始日期', '结束日期'],
    ['expected_end_date_from', 'expected_end_date_to', '预计完成开始日期', '预计完成结束日期'],
    ['submit_date_from', 'submit_date_to', '提出开始日期', '提出结束日期'],
    ['signed_date_from', 'signed_date_to', '签订开始日期', '签订结束日期'],
  ]
  for (const [from, to, fromLabel, toLabel] of datePairs) {
    if (!args[from] || !args[to]) continue
    if (!isRealDate(args[from])) {
      fieldErrors[to] ||= `${toLabel}暂时无法校验：${fromLabel}不是有效日期`
    } else if (isRealDate(args[to]) && args[to] < args[from]) {
      fieldErrors[to] = `${toLabel}不能早于${fromLabel}`
    }
  }
  if (Object.keys(fieldErrors).length) {
    throw argumentErrors(fieldErrors, validationMessages.length === 1 ? validationMessages[0] : undefined)
  }
  if (definition._meta?.endpointType === 'action') {
    const mode = args.mode
    if (mode === 'execute' && !args.confirmation_id) {
      throw argumentError('confirmation_id', '缺少操作确认号：执行操作时必须提供 preview 返回的 confirmation_id')
    }
    if (definition._meta.requiresSourceTarget) {
      const sourceType = Number(args.source_type)
      if (sourceType === 1 && !args.project_id) throw argumentError('project_id', '关联类型为项目时，必须提供关联项目')
      if (sourceType === 2 && !args.requirement_id) throw argumentError('requirement_id', '关联类型为需求时，必须提供关联需求')
    }
    if (definition._meta.requiresChanges
      && !definition._meta.editableFields.some((field) => args[field] !== undefined)) {
      throw argumentError('changes', '编辑操作至少需要提供一个要修改的字段')
    }
  }
}

function normalizeToolArguments(definition, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args) || args.sort_field === undefined) return args
  const sortField = normalizeSortField(definition.name, args.sort_field)
  return sortField === args.sort_field ? args : { ...args, sort_field: sortField }
}

function buildExecutePayload(publicToolName, publicArgs, result) {
  if (result?.resultStatus !== 'preview' || !result.executeArguments) return result
  const { executeArguments, ...publicResult } = result
  return {
    ...publicResult,
    execute_payload: {
      tool_name: publicToolName,
      arguments: {
        ...(publicArgs?.operation ? { operation: publicArgs.operation } : {}),
        ...executeArguments,
      },
    },
  }
}

function validateToolPermission(definition, args, context) {
  const permissionCode = definition._meta?.permissionCode
  if (permissionCode && !(context.allowedPermissionCodes instanceof Set
    && context.allowedPermissionCodes.has(permissionCode))) {
    const error = new Error('当前账号没有该按钮操作权限')
    error.code = 'MCP_PERMISSION_DENIED'
    throw error
  }
  if (definition.name === 'business_options' && args.option_type === 'user'
    && context.allowedMenuPaths.size === 0) {
    const error = new Error('当前账号没有可用的业务模块权限')
    error.code = 'MCP_PERMISSION_DENIED'
    throw error
  }
  const menuPath = definition.name === 'business_analyze'
    ? ANALYSIS_DOMAIN_MENU_PATHS[args.domain]
    : definition.name === 'business_options'
      ? OPTION_MENU_PATHS[args.option_type]
      : definition.name.startsWith('follow_up_record_')
        ? FOLLOW_UP_TARGET_MENU_PATHS[args.target_type]
      : definition._meta.menuPath
  if (menuPath && !context.allowedMenuPaths.has(menuPath)) {
    const error = new Error('当前账号没有该业务模块权限')
    error.code = 'MCP_PERMISSION_DENIED'
    throw error
  }
}

async function dispatchMcpTool(name, args, context) {
  const startedAt = Date.now()
  let definition
  let commandDefinition
  let commandName = name
  let commandArgs = args
  let result
  try {
    definition = getPublicToolDefinition(name, context.endpointType)
    if (!definition) {
      const error = new Error('工具不存在，或当前入口不允许调用该工具')
      error.code = 'MCP_TOOL_NOT_FOUND'
      throw error
    }
    const publicArgs = normalizeToolArguments(definition, args)
    validateToolArguments(definition, publicArgs)
    const resolved = resolvePublicTool(name, publicArgs, context.endpointType)
    commandName = resolved.name
    commandArgs = resolved.args
    commandDefinition = getCommandDefinition(commandName, context.endpointType)
    if (!commandDefinition) {
      const error = new Error('公共工具未映射到有效的内部命令')
      error.code = 'MCP_TOOL_NOT_FOUND'
      throw error
    }
    validateToolArguments(commandDefinition, commandArgs)
    validateToolPermission(commandDefinition, commandArgs, context)
    result = await (context.endpointType === 'query'
      ? dispatchQueryTool(commandName, commandArgs, context)
      : dispatchActionTool(commandName, commandArgs, context))
    if (context.endpointType === 'action') {
      result = buildExecutePayload(name, publicArgs, result)
    }
  } catch (error) {
    const audit = buildAuditSummary(commandName, commandArgs)
    await recordMcpAudit({
      requestId: context.auditRequestId,
      clientId: context.client.id,
      userId: context.user.id,
      employeeNo: context.user.employeeNo,
      endpointType: context.endpointType,
      protocolMethod: 'tools/call',
      toolName: name,
      riskLevel: context.endpointType === 'action' ? 'high' : 'low',
      module: audit.module || commandDefinition?._meta.menuPath || definition?._meta.menuPath,
      targetId: audit.targetId,
      targetName: audit.targetName,
      input: args,
      resultStatus: 'failed',
      errorCode: error.code || 'MCP_TOOL_ERROR',
      errorMessage: error.message,
      durationMs: Date.now() - startedAt,
      ip: context.ip,
    }).catch(() => {})
    throw error
  }
  const audit = buildAuditSummary(commandName, commandArgs, result)
  await recordMcpAudit({
    requestId: context.auditRequestId,
    clientId: context.client.id,
    userId: context.user.id,
    employeeNo: context.user.employeeNo,
    endpointType: context.endpointType,
    protocolMethod: 'tools/call',
    toolName: name,
    riskLevel: audit.riskLevel || (definition.annotations?.destructiveHint ? 'high' : context.endpointType === 'action' ? 'medium' : 'low'),
    module: audit.module || commandDefinition._meta.menuPath,
    targetId: audit.targetId,
    targetName: audit.targetName,
    input: args,
    resultStatus: 'success',
    resultCount: audit.resultCount,
    durationMs: Date.now() - startedAt,
    ip: context.ip,
  })
  return result
}

module.exports = {
  argumentError,
  buildExecutePayload,
  buildAuditSummary,
  dispatchMcpTool,
  normalizeToolArguments,
  resultCount,
  validateToolArguments,
  validateToolPermission,
}
