function toPostgresSql(sql) {
  let index = 0
  let inSingleQuote = false
  let inDoubleQuote = false
  let output = ''

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i]
    const prev = sql[i - 1]

    if (char === "'" && !inDoubleQuote && prev !== '\\') {
      inSingleQuote = !inSingleQuote
      output += char
      continue
    }

    if (char === '"' && !inSingleQuote && prev !== '\\') {
      inDoubleQuote = !inDoubleQuote
      output += char
      continue
    }

    if (char === '?' && !inSingleQuote && !inDoubleQuote) {
      index += 1
      output += `$${index}`
      continue
    }

    output += char
  }

  return output
}

function withReturningId(sql) {
  const trimmed = sql.trim()
  if (!/^insert\s+into/i.test(trimmed) || /\sreturning\s+/i.test(trimmed)) return sql
  return `${sql} RETURNING id`
}

module.exports = { toPostgresSql, withReturningId }
