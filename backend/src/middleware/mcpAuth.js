const db = require('../db')
const crypto = require('node:crypto')
const credentialService = require('../services/mcpCredentialService')
const { decryptEmployeeIdentity } = require('../services/mcpEmployeeIdentityCrypto')
const permissionService = require('../services/mcpPermissionService')
const { fail } = require('../utils/response')

class McpAuthError extends Error {
  constructor(message, status = 401) {
    super(message)
    this.name = 'McpAuthError'
    this.status = status
  }
}

function parseBearerToken(header) {
  const value = String(header || '')
  return value.startsWith('Bearer ') ? value.slice(7).trim() || null : null
}

function createMcpAuth({
  db: database = db,
  credentialService: credentials = credentialService,
  permissionService: permissions = permissionService,
} = {}) {
  async function resolvePrincipal(req, endpointType) {
    const token = parseBearerToken(req.headers?.authorization)
    if (!token) throw new McpAuthError('缺少智能体MCP凭据')
    let client
    try {
      client = await credentials.authenticateClient(token, endpointType)
    } catch (error) {
      throw new McpAuthError(error.message)
    }

    const encryptedEmployeeNo = String(req.headers?.['x-pmis-employee-no'] || '').trim()
    if (!encryptedEmployeeNo) throw new McpAuthError('缺少平台自动传入的员工号密文', 400)
    let employeeNo
    try {
      employeeNo = decryptEmployeeIdentity(encryptedEmployeeNo, token)
    } catch (error) {
      throw new McpAuthError(error.message, 400)
    }
    const user = await database.prepare(`
      SELECT id, employee_no, real_name, status, is_deleted
      FROM pms_user
      WHERE employee_no = ?
    `).get(employeeNo)
    if (!user) throw new McpAuthError('当前员工不存在', 403)
    if (Number(user.status) !== 1 || Number(user.is_deleted) === 1) {
      throw new McpAuthError('当前员工已停用', 403)
    }

    return {
      endpointType,
      client,
      user: { id: user.id, employeeNo: user.employee_no, realName: user.real_name },
      allowedMenuPaths: await permissions.getAllowedMenuPaths(user.id),
      ip: req.ip || req.socket?.remoteAddress || null,
      requestId: req.requestId,
      auditRequestId: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(req.requestId || ''))
        ? req.requestId
        : crypto.randomUUID(),
    }
  }

  function middleware(endpointType) {
    return async (req, res, next) => {
      try {
        req.mcpContext = await resolvePrincipal(req, endpointType)
        next()
      } catch (error) {
        fail(res, error.status || 401, error.status || 401, error.message)
      }
    }
  }

  return { middleware, resolvePrincipal }
}

const defaultAuth = createMcpAuth()

module.exports = {
  ...defaultAuth,
  McpAuthError,
  createMcpAuth,
  parseBearerToken,
}
