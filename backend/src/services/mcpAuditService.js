const db = require('../db')

const SECRET_KEYS = /(^|_)(authorization|token|secret|password|credential|cookie|confirmation|idempotency)($|_)/i
const FILE_KEYS = /(content_base64|file_buffer|file_content)/i

function redactAuditInput(value, key = '') {
  const normalizedKey = String(key).replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  if (SECRET_KEYS.test(normalizedKey)) return '[REDACTED]'
  if (FILE_KEYS.test(key)) return '[FILE_CONTENT]'
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redactAuditInput(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      redactAuditInput(childValue, childKey)
    ]))
  }
  if (typeof value === 'string' && value.length > 500) return `${value.slice(0, 500)}…`
  return value
}

async function recordMcpAudit(event, database = db) {
  return database.prepare(`
    INSERT INTO pms_mcp_audit_log (
      request_id, client_id, user_id, employee_no, endpoint_type, protocol_method,
      tool_name, risk_level, module, target_id, target_name, input_summary,
      result_status, result_count, error_code, error_message, duration_ms, ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?)
  `).run(
    event.requestId,
    event.clientId || null,
    event.userId || null,
    event.employeeNo || null,
    event.endpointType,
    event.protocolMethod,
    event.toolName || null,
    event.riskLevel || null,
    event.module || null,
    event.targetId || null,
    event.targetName || null,
    JSON.stringify(redactAuditInput(event.input || {})),
    event.resultStatus,
    event.resultCount ?? null,
    event.errorCode || null,
    event.errorMessage ? String(event.errorMessage).slice(0, 200) : null,
    Math.max(0, Math.round(Number(event.durationMs) || 0)),
    event.ip || null,
  )
}

module.exports = { recordMcpAudit, redactAuditInput }
