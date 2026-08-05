const db = require('../db')

async function executeOnce({ taskCode, targetType, targetId, executionKey }, handler, database = db) {
  const existing = await database.prepare(`SELECT id, status
    FROM pms_scheduled_task_execution
    WHERE task_code = ? AND target_type = ? AND target_id = ? AND execution_key = ?`).get(taskCode, targetType, targetId, executionKey)
  if (existing?.status === 'success' || existing?.status === 'running') return { executed: false, status: existing.status }

  let executionId = existing?.id
  if (executionId) {
    const claimed = await database.prepare(`UPDATE pms_scheduled_task_execution
      SET status = 'running', attempt_count = attempt_count + 1, error_message = NULL,
        result_data = NULL, started_at = NOW(), finished_at = NULL, updated_at = NOW()
      WHERE id = ? AND status = 'failed'`).run(executionId)
    if (!claimed.changes) return { executed: false, status: 'claimed' }
  } else {
    const result = await database.prepare(`INSERT INTO pms_scheduled_task_execution
      (task_code, target_type, target_id, execution_key, status)
      VALUES (?, ?, ?, ?, 'running') ON CONFLICT (task_code, target_type, target_id, execution_key) DO NOTHING`).run(
      taskCode, targetType, targetId, executionKey
    )
    executionId = result.lastInsertRowid
    if (!executionId) return { executed: false, status: 'claimed' }
  }

  try {
    const result = await handler()
    await database.prepare(`UPDATE pms_scheduled_task_execution
      SET status = 'success', result_data = ?, finished_at = NOW(), updated_at = NOW()
      WHERE id = ?`).run(result === undefined ? null : JSON.stringify(result), executionId)
    return { executed: true, status: 'success', result }
  } catch (error) {
    await database.prepare(`UPDATE pms_scheduled_task_execution
      SET status = 'failed', error_message = ?, finished_at = NOW(), updated_at = NOW()
      WHERE id = ?`).run(String(error?.message || error).slice(0, 500), executionId)
    throw error
  }
}

module.exports = { executeOnce }
