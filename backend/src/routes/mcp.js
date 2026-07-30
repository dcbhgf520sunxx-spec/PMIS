const express = require('express')
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js')
const { createMcpServer } = require('../mcp/createServer')
const { dispatchMcpTool } = require('../mcp/dispatcher')
const fileResources = require('../mcp/fileResources')
const { middleware: authenticateMcp } = require('../middleware/mcpAuth')
const { recordMcpAudit } = require('../services/mcpAuditService')

function configuredOrigins(env = process.env) {
  return [...new Set([
    env.ALLOWED_ORIGIN,
    ...String(env.MCP_ALLOWED_ORIGINS || '').split(','),
  ].map((value) => String(value || '').trim()).filter(Boolean))]
}

function validateMcpOrigin(origin, allowedOrigins = configuredOrigins()) {
  if (!origin) return
  if (!allowedOrigins.includes(origin)) throw new Error('MCP Origin不受信任')
}

function createMcpRateLimit(endpointType, {
  windowMs = 60_000,
  limit = Number(process.env[endpointType === 'query' ? 'MCP_QUERY_RATE_LIMIT' : 'MCP_ACTION_RATE_LIMIT'])
    || (endpointType === 'query' ? 240 : 60),
  now = Date.now,
  recordLimit = recordMcpAudit,
} = {}) {
  const buckets = new Map()
  let lastCleanupAt = 0
  return async (req, res, next) => {
    const messages = Array.isArray(req.body) ? req.body : [req.body]
    const toolCalls = messages.filter((message) => message?.method === 'tools/call')
    if (!toolCalls.length) return next()
    const current = now()
    if (current - lastCleanupAt >= windowMs) {
      for (const [bucketKey, entry] of buckets) {
        if (current - entry.startedAt >= windowMs) buckets.delete(bucketKey)
      }
      lastCleanupAt = current
    }
    const clientId = String(req.mcpContext?.client?.id || req.ip || 'unknown')
    const employeeNo = String(req.mcpContext?.user?.employeeNo || 'unknown')
    const key = `${clientId}:${employeeNo}`
    const previous = buckets.get(key)
    const bucket = !previous || current - previous.startedAt >= windowMs
      ? { startedAt: current, count: 0 }
      : previous
    bucket.count += toolCalls.length
    buckets.set(key, bucket)
    const resetAt = bucket.startedAt + windowMs
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - current) / 1000))
    res.set('RateLimit-Limit', String(limit))
    res.set('RateLimit-Remaining', String(Math.max(0, limit - bucket.count)))
    res.set('RateLimit-Reset', String(Math.ceil(resetAt / 1000)))
    if (bucket.count > limit) {
      res.set('Retry-After', String(retryAfterSeconds))
      await Promise.resolve(recordLimit({
        requestId: req.mcpContext?.auditRequestId,
        clientId: req.mcpContext?.client?.id,
        userId: req.mcpContext?.user?.id,
        employeeNo: req.mcpContext?.user?.employeeNo,
        endpointType,
        protocolMethod: 'tools/call',
        toolName: toolCalls.length === 1 ? toolCalls[0]?.params?.name || null : null,
        riskLevel: endpointType === 'action' ? 'high' : 'low',
        input: toolCalls.length === 1
          ? toolCalls[0]?.params?.arguments || {}
          : { batchToolNames: toolCalls.map((message) => message?.params?.name || null) },
        resultStatus: 'rate_limited',
        errorCode: 'MCP_RATE_LIMITED',
        errorMessage: `MCP请求过于频繁，${retryAfterSeconds}秒后可重试`,
        durationMs: 0,
        ip: req.mcpContext?.ip || req.ip,
      })).catch(() => {})
      return res.status(429).json({
        jsonrpc: '2.0',
        error: {
          code: -32029,
          message: `MCP请求过于频繁，请在${retryAfterSeconds}秒后重试`,
          data: {
            errorCode: 'MCP_RATE_LIMITED',
            endpointType,
            limit,
            windowSeconds: Math.ceil(windowMs / 1000),
            retryAfterSeconds,
            requestId: req.mcpContext?.auditRequestId || null,
          },
        },
        id: req.body?.id ?? null,
      })
    }
    next()
  }
}

async function auditProtocolRequest(req, resultStatus, error) {
  const context = req.mcpContext
  const protocolMethod = req.body?.method || req.method
  if (!context || protocolMethod === 'tools/call') return
  await recordMcpAudit({
    requestId: context.auditRequestId,
    clientId: context.client.id,
    userId: context.user.id,
    employeeNo: context.user.employeeNo,
    endpointType: context.endpointType,
    protocolMethod,
    input: req.body?.params || {},
    resultStatus,
    errorCode: error?.code || (error ? 'MCP_PROTOCOL_ERROR' : null),
    errorMessage: error?.message,
    durationMs: Date.now() - req.mcpStartedAt,
    ip: context.ip,
  })
}

function createMcpRouter(endpointType, {
  dispatch = dispatchMcpTool,
  listResourceTemplates = fileResources.listResourceTemplates,
  readResource = fileResources.readResource,
  allowedOrigins = configuredOrigins(),
} = {}) {
  const router = express.Router()
  router.use(authenticateMcp(endpointType))
  router.use(createMcpRateLimit(endpointType))
  router.all('/', async (req, res) => {
    req.mcpStartedAt = Date.now()
    try {
      validateMcpOrigin(req.get('origin'), allowedOrigins)
      const server = createMcpServer({
        context: req.mcpContext,
        dispatch,
        listResourceTemplates,
        readResource,
      })
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      })
      await server.connect(transport)
      try {
        await transport.handleRequest(req, res, req.body)
        await auditProtocolRequest(req, 'success')
      } finally {
        await server.close()
      }
    } catch (error) {
      try {
        await auditProtocolRequest(req, 'failed', error)
      } catch (auditError) {
        console.error('MCP协议审计记录失败', auditError)
      }
      if (!res.headersSent) {
        res.status(error.message?.includes('Origin') ? 403 : 500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: error.message || 'MCP请求失败' },
          id: req.body?.id ?? null,
        })
      }
    }
  })
  return router
}

const mcpRouter = express.Router()
mcpRouter.use('/query', createMcpRouter('query'))
mcpRouter.use('/action', createMcpRouter('action'))

module.exports = Object.assign(mcpRouter, {
  auditProtocolRequest,
  configuredOrigins,
  createMcpRateLimit,
  createMcpRouter,
  validateMcpOrigin,
})
