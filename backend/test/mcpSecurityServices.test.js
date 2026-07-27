const assert = require('node:assert/strict')
const test = require('node:test')

const { createMcpAuth, parseBearerToken } = require('../src/middleware/mcpAuth')
const { resolveEmployeeContext } = require('../src/mcp/dispatcher')
const { redactAuditInput } = require('../src/services/mcpAuditService')
const {
  canonicalizeActionArguments,
  createMcpActionTicketService,
  hashActionArguments,
} = require('../src/services/mcpActionTicketService')

test('MCP transport authentication only requires the endpoint credential', async () => {
  const auth = createMcpAuth({
    credentialService: { authenticateClient: async () => ({ id: 3, endpoint_type: 'query' }) },
  })
  const principal = await auth.resolvePrincipal({
    headers: {
      authorization: 'Bearer agent-token',
      'x-pmis-employee-no': 'SHOULD_BE_IGNORED'
    },
    ip: '127.0.0.1'
  }, 'query')

  assert.equal(principal.client.id, 3)
  assert.equal(principal.user, undefined)
  assert.equal(principal.allowedMenuPaths, undefined)
  assert.equal(parseBearerToken('Basic abc'), null)
})

test('MCP tool identity resolves required employee_no from arguments', async () => {
  const context = await resolveEmployeeContext({ employee_no: 'JS001' }, {
    client: { id: 3 },
    endpointType: 'query'
  }, {
    database: {
      prepare: () => ({
        get: async (employeeNo) => employeeNo === 'JS001'
          ? { id: 8, employee_no: 'JS001', real_name: '张三', status: 1, is_deleted: 0 }
          : null
      })
    },
    permissions: { getAllowedMenuPaths: async () => new Set(['/projects']) }
  })

  assert.equal(context.user.id, 8)
  assert.equal(context.user.employeeNo, 'JS001')
  assert.equal(context.allowedMenuPaths.has('/projects'), true)
})

test('MCP tool identity rejects a missing, unknown, disabled or deleted employee argument', async () => {
  const rows = [null, { id: 1, status: 0, is_deleted: 0 }, { id: 2, status: 1, is_deleted: 1 }]
  const dependencies = {
    database: { prepare: () => ({ get: async () => rows.shift() }) },
    permissions: { getAllowedMenuPaths: async () => new Set() }
  }
  const context = { client: { id: 3 }, endpointType: 'query' }

  await assert.rejects(resolveEmployeeContext({}, context, dependencies), /employee_no/)
  for (const expected of [/不存在/, /已停用/, /已停用/]) {
    await assert.rejects(resolveEmployeeContext({ employee_no: 'JS001' }, context, dependencies), expected)
  }
})

test('audit redaction removes credentials and file bodies while retaining useful filters', () => {
  const redacted = redactAuditInput({
    name: 'A项目',
    authorization: 'Bearer secret',
    token: 'secret',
    password: 'secret',
    content_base64: 'JVBERi0x',
    nested: { client_secret: 'secret', status: 1 }
  })

  assert.deepEqual(redacted, {
    name: 'A项目',
    authorization: '[REDACTED]',
    token: '[REDACTED]',
    password: '[REDACTED]',
    content_base64: '[FILE_CONTENT]',
    nested: { client_secret: '[REDACTED]', status: 1 }
  })
})

test('action argument hashing is stable and excludes protocol control fields', () => {
  const left = { mode: 'preview', b: 2, a: 1, confirmation_id: 'old', nested: { y: 2, x: 1 } }
  const right = { nested: { x: 1, y: 2 }, a: 1, b: 2, mode: 'execute', confirmation_id: 'new' }

  assert.deepEqual(canonicalizeActionArguments(left), { a: 1, b: 2, nested: { x: 1, y: 2 } })
  assert.equal(hashActionArguments(left), hashActionArguments(right))
})

test('action ticket rejects changed user, tool, arguments, expiry and replay', async () => {
  const baseRow = {
    id: 'ticket-1',
    client_id: 3,
    user_id: 8,
    employee_no: 'JS001',
    tool_name: 'task_update',
    arguments_hash: hashActionArguments({ id: 9, name: '新名称' }),
    status: 'pending',
    expires_at: '2026-07-27T00:05:00.000Z'
  }
  const createDb = (row) => ({
    transaction: async (fn) => fn({
      prepare: () => ({
        get: async () => ({ ...row }),
        run: async () => ({ changes: 1 })
      })
    })
  })
  const context = { client: { id: 3 }, user: { id: 8, employeeNo: 'JS001' } }
  const args = { id: 9, name: '新名称' }
  const now = () => new Date('2026-07-27T00:01:00.000Z')

  await assert.rejects(
    createMcpActionTicketService({ db: createDb({ ...baseRow, user_id: 10 }), now }).consumeTicket(context, 'task_update', args, 'ticket-1'),
    /不属于当前员工/
  )
  await assert.rejects(
    createMcpActionTicketService({ db: createDb({ ...baseRow, tool_name: 'task_delete' }), now }).consumeTicket(context, 'task_update', args, 'ticket-1'),
    /工具不匹配/
  )
  await assert.rejects(
    createMcpActionTicketService({ db: createDb(baseRow), now }).consumeTicket(context, 'task_update', { id: 9, name: '被替换' }, 'ticket-1'),
    /参数已变化/
  )
  await assert.rejects(
    createMcpActionTicketService({ db: createDb({ ...baseRow, expires_at: '2026-07-27T00:00:30.000Z' }), now }).consumeTicket(context, 'task_update', args, 'ticket-1'),
    /已过期/
  )
  await assert.rejects(
    createMcpActionTicketService({ db: createDb({ ...baseRow, status: 'executed' }), now }).consumeTicket(context, 'task_update', args, 'ticket-1'),
    /已使用/
  )
})
