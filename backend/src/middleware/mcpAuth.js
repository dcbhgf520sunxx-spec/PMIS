const crypto = require('node:crypto')
const credentialService = require('../services/mcpCredentialService')
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
  credentialService: credentials = credentialService,
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

    return {
      endpointType,
      client,
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
