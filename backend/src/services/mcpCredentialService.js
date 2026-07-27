const crypto = require('node:crypto')
const db = require('../db')

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex')
}

function createMcpCredentialService({
  db: database = db,
  now = () => new Date(),
  randomBytes = crypto.randomBytes,
} = {}) {
  async function authenticateClient(token, endpointType) {
    if (!token) throw new Error('MCP凭据缺失')
    if (!['query', 'action'].includes(endpointType)) throw new Error('MCP入口类型无效')
    const client = await database.prepare(`
      SELECT id, name, endpoint_type, status, is_deleted, expires_at
      FROM pms_mcp_client
      WHERE token_hash = ?
    `).get(hashToken(token))
    if (!client || Number(client.is_deleted) === 1) throw new Error('MCP凭据无效')
    if (Number(client.status) !== 1) throw new Error('MCP凭据已停用')
    if (client.endpoint_type !== endpointType) throw new Error('MCP凭据与入口不匹配')
    if (client.expires_at && new Date(client.expires_at).getTime() <= now().getTime()) throw new Error('MCP凭据已过期')
    await database.prepare('UPDATE pms_mcp_client SET last_used_at = ?, updated_at = NOW() WHERE id = ?')
      .run(now().toISOString(), client.id)
    return client
  }

  async function issueClient({ name, endpointType, expiresAt = null, createdBy = null }) {
    const normalizedName = String(name || '').trim()
    if (!normalizedName) throw new Error('智能体名称不能为空')
    if (!['query', 'action'].includes(endpointType)) throw new Error('入口类型必须是 query 或 action')
    const prefix = endpointType === 'query' ? 'pmis_q_' : 'pmis_a_'
    const token = `${prefix}${randomBytes(32).toString('base64url')}`
    const tokenPrefix = token.slice(0, 12)
    const result = await database.prepare(`
      INSERT INTO pms_mcp_client (
        name, token_prefix, token_hash, endpoint_type, expires_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(normalizedName, tokenPrefix, hashToken(token), endpointType, expiresAt, createdBy)
    return { id: result.lastInsertRowid, name: normalizedName, endpointType, token, tokenPrefix, expiresAt }
  }

  async function revokeClient(id) {
    const result = await database.prepare(`
      UPDATE pms_mcp_client
      SET status = 0, is_deleted = 1, updated_at = NOW()
      WHERE id = ? AND is_deleted = 0
    `).run(id)
    if (!result.changes) throw new Error('MCP客户端不存在')
  }

  async function listClients() {
    return database.prepare(`
      SELECT id, name, token_prefix, endpoint_type, status, expires_at, last_used_at,
        created_by, created_at, updated_at
      FROM pms_mcp_client
      WHERE is_deleted = 0
      ORDER BY created_at DESC, id DESC
    `).all()
  }

  return { authenticateClient, issueClient, listClients, revokeClient }
}

module.exports = {
  ...createMcpCredentialService(),
  createMcpCredentialService,
  hashToken,
}
