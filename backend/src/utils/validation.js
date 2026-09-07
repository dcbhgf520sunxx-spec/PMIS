function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

function isValidNumber(value) {
  if (isBlank(value)) return true
  return Number.isFinite(Number(value))
}

function normalizeForEnum(value) {
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return value
}

function fail(message) {
  return { ok: false, message }
}

function validateValue(value, rule, label, prefix = '') {
  const name = `${prefix}${label}`
  if (rule.required && isBlank(value)) return fail(`${name}不能为空`)
  if (isBlank(value)) return { ok: true }

  if (rule.type === 'number' && !isValidNumber(value)) return fail(`${name}必须是数字`)
  if (rule.type === 'enum' && !rule.values.includes(normalizeForEnum(value))) return fail(`${name}取值无效`)
  if (rule.maxLength && String(value).trim().length > rule.maxLength) return fail(`${name}不能超过${rule.maxLength}字符`)
  if (rule.type === 'array') {
    if (!Array.isArray(value)) return fail(`${name}必须是数组`)
    if (rule.required && value.length === 0) return fail(`${name}不能为空`)
    if (rule.itemSchema) {
      for (let index = 0; index < value.length; index += 1) {
        const itemResult = validateBody(value[index] || {}, rule.itemSchema, `${name}第${index + 1}项的`)
        if (!itemResult.ok) return itemResult
      }
    }
  }

  return { ok: true }
}

function validateBody(body = {}, schema = {}, prefix = '') {
  for (const [field, rule] of Object.entries(schema)) {
    const result = validateValue(body[field], rule, rule.label || field, prefix)
    if (!result.ok) return result
  }
  return { ok: true }
}

module.exports = { validateBody }
