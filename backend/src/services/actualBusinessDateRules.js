function getShanghaiDateText() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function validateActualBusinessDate(value, label, today = getShanghaiDateText()) {
  if (value === undefined || value === null || value === '') return null
  const text = String(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    return `${label}格式不正确，请使用YYYY-MM-DD`
  }
  if (new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) !== text) {
    return `${label}格式不正确，请使用YYYY-MM-DD`
  }
  return text > today ? `${label}不能晚于今天（${today}）` : null
}

module.exports = { validateActualBusinessDate }
