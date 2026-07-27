const assert = require('node:assert/strict')
const test = require('node:test')

const { createMcpAuth, parseBearerToken } = require('../src/middleware/mcpAuth')
const { redactAuditInput } = require('../src/services/mcpAuditService')
const {
  encryptEmployeeIdentity,
} = require('../src/services/mcpEmployeeIdentityCrypto')
const {
  canonicalizeActionArguments,
  createMcpActionTicketService,
  hashActionArguments,
} = require('../src/services/mcpActionTicketService')

test('MCP identity accepts only a short-lived encrypted employee header', async () => {
  const token = 'agent-token'
  const auth = createMcpAuth({
    credentialService: { authenticateClient: async () => ({ id: 3, endpoint_type: 'query' }) },
    db: {
      prepare: () => ({
        get: async (employeeNo) => employeeNo === 'JS001'
          ? { id: 8, employee_no: 'JS001', real_name: '张三', status: 1, is_deleted: 0 }
          : null
      })
    },
    permissionService: { getAllowedMenuPaths: async () => new Set(['/projects']) }
  })
  const principal = await auth.resolvePrincipal({
    headers: {
      authorization: `Bearer ${token}`,
      'x-pmis-employee-no': encryptEmployeeIdentity('JS001', token)
    },
    body: { employee_no: 'admin' },
    ip: '127.0.0.1'
  }, 'query')

  assert.equal(principal.user.id, 8)
  assert.equal(principal.user.employeeNo, 'JS001')
  assert.equal(principal.allowedMenuPaths.has('/projects'), true)
  assert.equal(parseBearerToken('Basic abc'), null)
})

test('MCP identity rejects plaintext, tampered, expired or token-mismatched employee headers', async () => {
  const token = 'agent-token'
  const auth = createMcpAuth({
    credentialService: { authenticateClient: async () => ({ id: 3 }) },
    db: { prepare: () => ({ get: async () => ({ id: 1, status: 1, is_deleted: 0 }) }) },
    permissionService: { getAllowedMenuPaths: async () => new Set() }
  })
  const current = encryptEmployeeIdentity('JS001', token)
  const tamperedParts = current.split('.')
  tamperedParts[3] = `${tamperedParts[3][0] === 'A' ? 'B' : 'A'}${tamperedParts[3].slice(1)}`
  const tampered = tamperedParts.join('.')
  const expired = encryptEmployeeIdentity('JS001', token, { now: Date.now() - 10 * 60 * 1000 })

  await assert.rejects(auth.resolvePrincipal({
    headers: { authorization: `Bearer ${token}`, 'x-pmis-employee-no': 'JS001' }
  }, 'query'), /密文格式/)
  await assert.rejects(auth.resolvePrincipal({
    headers: { authorization: `Bearer ${token}`, 'x-pmis-employee-no': tampered }
  }, 'query'), /校验失败/)
  await assert.rejects(auth.resolvePrincipal({
    headers: { authorization: `Bearer ${token}`, 'x-pmis-employee-no': expired }
  }, 'query'), /已过期/)
  await assert.rejects(auth.resolvePrincipal({
    headers: { authorization: 'Bearer other-token', 'x-pmis-employee-no': current }
  }, 'query'), /校验失败/)
})

test('MCP identity rejects a missing, unknown, disabled or deleted employee', async () => {
  const token = 'agent-token'
  const rows = [null, { id: 1, status: 0, is_deleted: 0 }, { id: 2, status: 1, is_deleted: 1 }]
  const auth = createMcpAuth({
    credentialService: { authenticateClient: async () => ({ id: 3 }) },
    db: { prepare: () => ({ get: async () => rows.shift() }) },
    permissionService: { getAllowedMenuPaths: async () => new Set() }
  })

  await assert.rejects(auth.resolvePrincipal({ headers: { authorization: 'Bearer x' } }, 'query'), /员工号/)
  for (const expected of [/不存在/, /已停用/, /已停用/]) {
    await assert.rejects(auth.resolvePrincipal({
      headers: {
        authorization: `Bearer ${token}`,
        'x-pmis-employee-no': encryptEmployeeIdentity('JS001', token)
      }
    }, 'query'), expected)
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
