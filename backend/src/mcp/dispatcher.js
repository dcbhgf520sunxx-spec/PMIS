const { getToolDefinition } = require('./catalog')
const { dispatchQueryTool } = require('./queryTools')
const { dispatchActionTool } = require('./actionTools')
const { recordMcpAudit } = require('../services/mcpAuditService')
const db = require('../db')
const permissionService = require('../services/mcpPermissionService')

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
    if (property?.maxLength && typeof value === 'string' && value.length > property.maxLength) throw new Error(`${key}参数过长`)
    if (property?.maxItems && Array.isArray(value) && value.length > property.maxItems) throw new Error(`${key}参数数量过多`)
  }
}

function validateToolPermission(definition, args, context) {
  const menuPath = definition.name === 'business_analyze'
    ? ANALYSIS_DOMAIN_MENU_PATHS[args.domain]
    : definition._meta.menuPath
  if (menuPath && !context.allowedMenuPaths.has(menuPath)) throw new Error('没有该业务模块权限')
}

async function resolveEmployeeContext(args, context, {
  database = db,
  permissions = permissionService,
} = {}) {
  const employeeNo = String(args?.employee_no || '').trim()
  if (!employeeNo) throw new Error('缺少参数：employee_no')
  const user = await database.prepare(`
    SELECT id, employee_no, real_name, status, is_deleted
    FROM pms_user
    WHERE employee_no = ?
  `).get(employeeNo)
  if (!user) throw new Error('当前员工不存在')
  if (Number(user.status) !== 1 || Number(user.is_deleted) === 1) throw new Error('当前员工已停用')
  return {
    ...context,
    user: { id: user.id, employeeNo: user.employee_no, realName: user.real_name },
    allowedMenuPaths: await permissions.getAllowedMenuPaths(user.id),
  }
}

async function dispatchMcpTool(name, args, context) {
  const startedAt = Date.now()
  let definition
  let result
  let employeeContext = context
  try {
    definition = getToolDefinition(name, context.endpointType)
    if (!definition) throw new Error('工具不存在或入口类型不匹配')
    validateToolArguments(definition, args)
    employeeContext = await resolveEmployeeContext(args, context)
    validateToolPermission(definition, args, employeeContext)
    const businessArgs = { ...args }
    delete businessArgs.employee_no
    result = await (employeeContext.endpointType === 'query'
      ? dispatchQueryTool(name, businessArgs, employeeContext)
      : dispatchActionTool(name, businessArgs, employeeContext))
  } catch (error) {
    await recordMcpAudit({
      requestId: context.auditRequestId,
      clientId: context.client.id,
      userId: employeeContext.user?.id,
      employeeNo: employeeContext.user?.employeeNo || String(args?.employee_no || '').trim() || null,
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
    userId: employeeContext.user.id,
    employeeNo: employeeContext.user.employeeNo,
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

module.exports = {
  dispatchMcpTool,
  resolveEmployeeContext,
  validateToolArguments,
  validateToolPermission,
}
