const crypto = require('node:crypto')
const db = require('../db')

const CONTROL_KEYS = new Set(['mode', 'confirmation_id'])

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
    return { confirmationId: id, expiresAt: expiresAt.toISOString(), preview, riskLevel }
  }

  async function consumeTicket(context, toolName, args, confirmationId) {
    if (!confirmationId) throw new Error('缺少操作确认号')
    return database.transaction(async (tx) => {
      const row = await tx.prepare(`
        SELECT *
        FROM pms_mcp_action_ticket
        WHERE id = ?
        FOR UPDATE
      `).get(confirmationId)
      if (!row) throw new Error('操作确认号不存在')
      if (Number(row.client_id) !== Number(context.client.id)) throw new Error('操作确认号不属于当前智能体')
      if (Number(row.user_id) !== Number(context.user.id) || row.employee_no !== context.user.employeeNo) {
        throw new Error('操作确认号不属于当前员工')
      }
      if (row.tool_name !== toolName) throw new Error('操作确认号与工具不匹配')
      if (row.status !== 'pending') throw new Error('操作确认号已使用或失效')
      if (new Date(row.expires_at).getTime() <= now().getTime()) {
        await tx.prepare("UPDATE pms_mcp_action_ticket SET status = 'expired' WHERE id = ?").run(row.id)
        throw new Error('操作确认号已过期')
      }
      if (row.arguments_hash !== hashActionArguments(args)) throw new Error('操作参数已变化，请重新预览')
      await tx.prepare(`
        UPDATE pms_mcp_action_ticket
        SET status = 'executed', executed_at = ?
        WHERE id = ? AND status = 'pending'
      `).run(now().toISOString(), row.id)
      return row
    })
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
