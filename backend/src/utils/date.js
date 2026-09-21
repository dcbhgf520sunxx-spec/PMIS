function getShanghaiDateText(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

module.exports = { getShanghaiDateText }

function businessDateText(value, timestamp = false) {
  if (!value) return null
  const text = String(value)
  if (timestamp && !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : getShanghaiDateText(date)
  }
  const date = text.slice(0, 10)
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date
}
function calendarDaysBetween(later, earlier) {
  return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86400000)
}
module.exports.businessDateText = businessDateText
module.exports.calendarDaysBetween = calendarDaysBetween
