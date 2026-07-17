const { fail } = require('./response')
const { validateBody } = require('./validation')

function requireValidBody(res, body, schema) {
  const result = validateBody(body, schema)
  if (result.ok) return true
  fail(res, 400, 400, result.message)
  return false
}

module.exports = { requireValidBody }
