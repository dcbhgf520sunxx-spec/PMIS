const crypto = require('node:crypto')
const db = require('../db')

const CONTROL_KEYS = new Set(['mode', 'confirmation_id'])

function actionTicketError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).filter((key) => !CONTROL_KEYS.has(key)).sort()
        .map((key) => [key, sortValue(value[key])])
    )
  }
  return value
}

function canonicalizeActionArguments(args) {
  return sortValue(args || {})
}

function hashActionArguments(args) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(canonicalizeActionArguments(args)), 'utf8')
    .digest('hex')
}

function createMcpActionTicketService({
  db: database = db,
  now = () => new Date(),
  randomUUID = crypto.randomUUID,
} = {}) {
  async function createTicket(context, toolName, args, preview, riskLevel = 'medium') {
    const id = randomUUID()
    const createdAt = now()
    const expiresAt = new Date(createdAt.getTime() + 5 * 60 * 1000)
    const idempotencyKey = args?.idempotency_key || null
    try {
      await database.prepare(`
        INSERT INTO pms_mcp_action_ticket (
          id, client_id, user_id, employee_no, tool_name, arguments_hash,
          preview, idempotency_key, risk_level, status, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, 'pending', ?)
      `).run(
        id,
        context.client.id,
        context.user.id,
        context.user.employeeNo,
        toolName,
        hashActionArguments(args),
        JSON.stringify(preview),
        idempotencyKey,
        riskLevel,
        expiresAt.toISOString(),
      )
    } catch (error) {
      if (idempotencyKey && error.code === '23505' && error.constraint === 'ux_mcp_ticket_idempotency') {
        throw actionTicketError('MCP_IDEMPOTENCY_CONFLICT', '幂等键已使用，请勿重复发起同一操作')
      }
      throw error
    }
    return { confirmationId: id, expiresAt: expiresAt.toISOString(), preview, riskLevel }
  }

  async function consumeTicket(context, toolName, args, confirmationId) {
    if (!confirmationId) throw actionTicketError('MCP_CONFIRMATION_REQUIRED', '缺少操作确认号')
    const result = await database.transaction(async (tx) => {
      const row = await tx.prepare(`
        SELECT *
        FROM pms_mcp_action_ticket
        WHERE id = ?
        FOR UPDATE
      `).get(confirmationId)
      if (!row) throw actionTicketError('MCP_CONFIRMATION_NOT_FOUND', '操作确认号不存在')
      if (Number(row.client_id) !== Number(context.client.id)) {
        throw actionTicketError('MCP_CONFIRMATION_CLIENT_MISMATCH', '操作确认号不属于当前智能体')
      }
      if (Number(row.user_id) !== Number(context.user.id) || row.employee_no !== context.user.employeeNo) {
        throw actionTicketError('MCP_CONFIRMATION_EMPLOYEE_MISMATCH', '操作确认号不属于当前员工')
      }
      if (row.tool_name !== toolName) {
        throw actionTicketError('MCP_CONFIRMATION_TOOL_MISMATCH', '操作确认号与工具不匹配')
      }
      if (row.status !== 'pending') {
        throw actionTicketError('MCP_CONFIRMATION_ALREADY_USED', '操作确认号已使用或失效')
      }
      if (new Date(row.expires_at).getTime() <= now().getTime()) {
        await tx.prepare("UPDATE pms_mcp_action_ticket SET status = 'expired' WHERE id = ?").run(row.id)
        return { expired: true }
      }
      if (row.arguments_hash !== hashActionArguments(args)) {
        throw actionTicketError('MCP_CONFIRMATION_ARGUMENTS_CHANGED', '操作参数已变化，请重新预览')
      }
      await tx.prepare(`
        UPDATE pms_mcp_action_ticket
        SET status = 'executed', executed_at = ?
        WHERE id = ? AND status = 'pending'
      `).run(now().toISOString(), row.id)
      return { row }
    })
    if (result.expired) {
      throw actionTicketError('MCP_CONFIRMATION_EXPIRED', '操作确认号已过期')
    }
    return result.row
  }

  async function markTicketFailed(confirmationId) {
    return database.prepare(`
      UPDATE pms_mcp_action_ticket
      SET status = 'failed'
      WHERE id = ? AND status = 'executed'
    `).run(confirmationId)
  }

  return { consumeTicket, createTicket, markTicketFailed }
}

module.exports = {
  ...createMcpActionTicketService(),
  canonicalizeActionArguments,
  createMcpActionTicketService,
  hashActionArguments,
}
