const { getToolDefinition } = require('./catalog')
const { dispatchQueryTool } = require('./queryTools')
const { dispatchActionTool } = require('./actionTools')
const { recordMcpAudit } = require('../services/mcpAuditService')

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

function resultCount(result) {
  if (Array.isArray(result)) return result.length
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

function validateSchemaValue(schema, value, path) {
  const types = Array.isArray(schema?.type) ? schema.type : schema?.type ? [schema.type] : []
  if (types.length && !types.some((type) => matchesJsonType(type, value))) {
    throw new Error(`${path}参数类型不合法`)
  }
  if (schema?.format === 'uuid' && typeof value === 'string'
    && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${path}格式不合法`)
  }
  if (schema?.maxLength && typeof value === 'string' && value.length > schema.maxLength) {
    throw new Error(`${path}参数过长`)
  }
  if (schema?.minItems && Array.isArray(value) && value.length < schema.minItems) {
    throw new Error(`${path}参数数量不足`)
  }
  if (schema?.maxItems && Array.isArray(value) && value.length > schema.maxItems) {
    throw new Error(`${path}参数数量过多`)
  }
  if (Array.isArray(value) && schema?.items) {
    value.forEach((item, index) => validateSchemaValue(schema.items, item, `${path}[${index}]`))
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema?.properties || {}
    const required = schema?.required || []
    const missing = required.filter((key) => value[key] === undefined || value[key] === null || value[key] === '')
    if (missing.length) throw new Error(`缺少参数：${missing.map((key) => `${path}.${key}`).join('、')}`)
    for (const [key, childValue] of Object.entries(value)) {
      const childSchema = properties[key] || (schema?.additionalProperties && schema.additionalProperties !== true
        ? schema.additionalProperties
        : null)
      if (childSchema) validateSchemaValue(childSchema, childValue, `${path}.${key}`)
      else if (schema?.additionalProperties === false) throw new Error(`不支持的参数：${path}.${key}`)
    }
  }
}

function validateToolArguments(definition, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('工具参数必须是对象')
  const schema = definition.inputSchema || {}
  const allowed = new Set(Object.keys(schema.properties || {}))
  const unknown = Object.keys(args).filter((key) => !allowed.has(key))
  if (unknown.length) throw new Error(`不支持的参数：${unknown.join('、')}`)
  const missing = (schema.required || []).filter((key) => args[key] === undefined || args[key] === null || args[key] === '')
  if (missing.length) throw new Error(`缺少参数：${missing.join('、')}`)
  for (const [key, value] of Object.entries(args)) {
    const property = schema.properties?.[key]
    if (property?.enum && !property.enum.includes(value)) throw new Error(`${key}参数值不合法`)
    if (property) validateSchemaValue(property, value, key)
  }
  if (definition._meta?.endpointType === 'action') {
    const mode = args.mode || 'preview'
    if (mode === 'execute' && !args.confirmation_id) throw new Error('缺少操作确认号')
    if (['task_create', 'task_update', 'bug_create', 'bug_update'].includes(definition.name)) {
      const sourceType = Number(args.source_type)
      if (sourceType === 1 && !args.project_id) throw new Error('缺少参数：project_id')
      if (sourceType === 2 && !args.requirement_id) throw new Error('缺少参数：requirement_id')
    }
  }
}

function validateToolPermission(definition, args, context) {
  const menuPath = definition.name === 'business_analyze'
    ? ANALYSIS_DOMAIN_MENU_PATHS[args.domain]
    : definition._meta.menuPath
  if (menuPath && !context.allowedMenuPaths.has(menuPath)) throw new Error('没有该业务模块权限')
}

async function dispatchMcpTool(name, args, context) {
  const startedAt = Date.now()
  let definition
  let result
  try {
    definition = getToolDefinition(name, context.endpointType)
    if (!definition) throw new Error('工具不存在或入口类型不匹配')
    validateToolArguments(definition, args)
    validateToolPermission(definition, args, context)
    result = await (context.endpointType === 'query'
      ? dispatchQueryTool(name, args, context)
      : dispatchActionTool(name, args, context))
  } catch (error) {
    await recordMcpAudit({
      requestId: context.auditRequestId,
      clientId: context.client.id,
      userId: context.user.id,
      employeeNo: context.user.employeeNo,
      endpointType: context.endpointType,
      protocolMethod: 'tools/call',
      toolName: name,
      riskLevel: context.endpointType === 'action' ? 'high' : 'low',
      module: definition?._meta.menuPath,
      targetId: args.id || args.project_id || args.item_id || null,
      input: args,
      resultStatus: 'failed',
      errorCode: error.code || 'MCP_TOOL_ERROR',
      errorMessage: error.message,
      durationMs: Date.now() - startedAt,
      ip: context.ip,
    })
    throw error
  }
  await recordMcpAudit({
    requestId: context.auditRequestId,
    clientId: context.client.id,
    userId: context.user.id,
    employeeNo: context.user.employeeNo,
    endpointType: context.endpointType,
    protocolMethod: 'tools/call',
    toolName: name,
    riskLevel: definition.annotations?.destructiveHint ? 'high' : context.endpointType === 'action' ? 'medium' : 'low',
    module: definition._meta.menuPath,
    targetId: args.id || args.project_id || args.item_id || null,
    input: args,
    resultStatus: 'success',
    resultCount: resultCount(result),
    durationMs: Date.now() - startedAt,
    ip: context.ip,
  })
  return result
}

module.exports = { dispatchMcpTool, validateToolArguments, validateToolPermission }
