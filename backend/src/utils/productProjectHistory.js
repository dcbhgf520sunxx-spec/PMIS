function formatDate(value) {
  if (value === null || value === undefined || value === '') return ''
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function serializeMemberIds(ids) {
  return JSON.stringify([...new Set((ids || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b))
}

function formatHistoryChanges(changes, { fieldLabels = {}, dateFields = new Set(), valueLookups = {}, arrayValueLookups = {} } = {}) {
  return changes.map((change) => {
    const formatValue = (value) => {
      if (dateFields.has(change.field_name)) return formatDate(value)
      const arrayLookup = arrayValueLookups[change.field_name]
      if (arrayLookup) {
        let ids = []
        try { ids = JSON.parse(String(value || '[]')) } catch { return String(value || '') }
        return ids.map((id) => arrayLookup.get(String(id)) || String(id)).join('、')
      }
      const lookup = valueLookups[change.field_name]
      return lookup?.get(String(value)) ?? (value === null || value === undefined ? '' : String(value))
    }
    return {
      field_name: fieldLabels[change.field_name] || change.field_name,
      old_value: formatValue(change.old_value),
      new_value: formatValue(change.new_value),
    }
  })
}

module.exports = { formatHistoryChanges, serializeMemberIds }
