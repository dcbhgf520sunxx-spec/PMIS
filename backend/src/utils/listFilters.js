function numberListCondition(column, value) {
  if (value === undefined || value === null) return { sql: '', params: [] }
  const parts = (Array.isArray(value) ? value : [value])
    .flatMap(item => String(item).split(',')).map(item => item.trim()).filter(Boolean)
  if (!parts.length) return { sql: '', params: [] }
  const numbers = parts.map(Number)
  if (numbers.some(item => !Number.isSafeInteger(item))) return { sql: ' AND 1=0', params: [] }
  const params = [...new Set(numbers)]
  return { sql: ` AND ${column} IN (${params.map(() => '?').join(',')})`, params }
}

module.exports = { numberListCondition }
