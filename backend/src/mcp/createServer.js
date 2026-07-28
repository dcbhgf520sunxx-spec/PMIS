const { Server } = require('@modelcontextprotocol/sdk/server/index.js')
const {
  CallToolRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js')
const { filterToolsForContext } = require('./catalog')

function asToolResult(value) {
  const structuredContent = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : { data: value }
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent,
  }
}

function normalizeToolError(error) {
  const fallbackMessage = 'MCP工具执行失败'
  const originalCode = error?.code
  const isContractError = typeof originalCode === 'string' && /^MCP_[A-Z0-9_]+$/.test(originalCode)
  return {
    code: isContractError ? originalCode : 'MCP_TOOL_ERROR',
    message: isContractError ? error.message || fallbackMessage : fallbackMessage,
    ...(!isContractError && originalCode !== undefined
      ? { originalCode: String(originalCode) }
      : {}),
    ...(error?.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
  }
}

function createMcpServer({
  context,
  dispatch,
  listResourceTemplates = async () => [],
  readResource = async () => { throw new Error('资源不存在') },
}) {
  const capabilities = { tools: {} }
  if (context.endpointType === 'query') capabilities.resources = {}
  const server = new Server(
    { name: `pmis-${context.endpointType}`, version: '1.0.0' },
    { capabilities }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: filterToolsForContext(context),
  }))
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return asToolResult(await dispatch(request.params.name, request.params.arguments || {}, context))
    } catch (error) {
      const normalizedError = normalizeToolError(error)
      return {
        content: [{ type: 'text', text: normalizedError.message }],
        structuredContent: {
          error: normalizedError,
        },
        isError: true,
      }
    }
  })

  if (context.endpointType === 'query') {
    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      resourceTemplates: await listResourceTemplates(context),
    }))
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => ({
      contents: [await readResource(request.params.uri, context)],
    }))
  }
  return server
}

module.exports = { asToolResult, createMcpServer, normalizeToolError }
