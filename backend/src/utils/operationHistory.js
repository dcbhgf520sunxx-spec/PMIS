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

function formatHistoryDate(value) {
  if (value === null || value === undefined || value === '') return ''
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

function formatHistoryChanges(changes, { fieldLabels = {}, dateFields = new Set(), valueLookups = {}, valueResolver } = {}) {
  return changes.map((change) => {
    const formatValue = (value) => {
      if (valueResolver) {
        const resolved = valueResolver(change.field_name, value)
        if (resolved !== undefined) return resolved
      }
      if (dateFields.has(change.field_name)) return formatHistoryDate(value)
      const lookup = valueLookups[change.field_name]
      if (lookup) return lookup.get(String(value)) ?? '-'
      return value === null || value === undefined ? '' : String(value)
    }
    return {
      field_name: fieldLabels[change.field_name] || '其他字段',
      old_value: formatValue(change.old_value),
      new_value: formatValue(change.new_value)
    }
  })
}

module.exports = { createOperationId, formatHistoryChanges, groupOperationLogs }
