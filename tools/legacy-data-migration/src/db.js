function quoteIdentifier(value) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error(`SQL 标识符非法：${value}`)
  return `"${value}"`
}

async function insertRows(client, table, columns, rows, { suffix = '' } = {}) {
  if (!rows.length) return 0
  const quotedTable = quoteIdentifier(table)
  const quotedColumns = columns.map(quoteIdentifier).join(', ')
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
  const sql = `INSERT INTO ${quotedTable} (${quotedColumns}) VALUES (${placeholders})${suffix ? ` ${suffix}` : ''}`
  for (const row of rows) {
    await client.query(sql, columns.map((column) => row[column] ?? null))
  }
  return rows.length
}

module.exports = { insertRows, quoteIdentifier }
