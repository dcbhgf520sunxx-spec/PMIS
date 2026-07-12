const { randomUUID } = require('node:crypto')

function createOperationId() {
  return randomUUID()
}

function groupOperationLogs(logs, fieldOrder = []) {
  const order = new Map(fieldOrder.map((field, index) => [field, index]))
  const groups = []
  const byId = new Map()
  for (const log of logs) {
    const key = log.operation_id || `legacy-${log.id}`
    if (!byId.has(key)) {
      const group = { ...log, changes: [] }
      groups.push(group)
      byId.set(key, group)
    }
    byId.get(key).changes.push(log)
  }
  for (const group of groups) {
    group.changes.sort((a, b) => (order.get(a.field_name) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.field_name) ?? Number.MAX_SAFE_INTEGER))
  }
  return groups
}

module.exports = { createOperationId, groupOperationLogs }
