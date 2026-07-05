const db = require('../db')

const VALID_TYPES = new Set(['notification', 'system'])

function normalizeMessage(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    link_path: row.link_path,
    read_at: row.read_at,
    created_at: row.created_at,
  }
}

async function listMessages(userId, query = {}) {
  const params = [userId]
  let sql = `
    SELECT id, type, title, description, link_path, read_at, created_at
    FROM pms_message
    WHERE recipient_user_id = ? AND is_deleted = 0
  `

  if (query.type && VALID_TYPES.has(query.type)) {
    sql += ' AND type = ?'
    params.push(query.type)
  }

  sql += ' ORDER BY read_at IS NOT NULL ASC, created_at DESC, id DESC LIMIT 50'

  const rows = await db.prepare(sql).all(...params)
  return rows.map(normalizeMessage)
}

async function markMessageRead(userId, messageId) {
  const row = await db.prepare(
    'SELECT id FROM pms_message WHERE id = ? AND recipient_user_id = ? AND is_deleted = 0'
  ).get(messageId, userId)

  if (!row) {
    const error = new Error('消息不存在')
    error.statusCode = 404
    throw error
  }

  await db.prepare(
    'UPDATE pms_message SET read_at = COALESCE(read_at, NOW()), updated_at = NOW() WHERE id = ? AND recipient_user_id = ?'
  ).run(messageId, userId)

  return { id: Number(messageId) }
}

async function markAllMessagesRead(userId) {
  const result = await db.prepare(
    'UPDATE pms_message SET read_at = COALESCE(read_at, NOW()), updated_at = NOW() WHERE recipient_user_id = ? AND is_deleted = 0 AND read_at IS NULL'
  ).run(userId)

  return { updated: result.changes || 0 }
}

module.exports = {
  listMessages,
  markMessageRead,
  markAllMessagesRead,
  normalizeMessage,
}
