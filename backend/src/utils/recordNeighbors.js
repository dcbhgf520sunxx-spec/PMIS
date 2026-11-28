function parseNeighborIds(query) {
  const value = query.ids === undefined ? query.id : query.ids
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const parts = String(value).split(',').map(part => part.trim())
  if (parts.some(part => !/^\d+$/.test(part) || !Number.isSafeInteger(Number(part)) || Number(part) <= 0)) return null
  return [...new Set(parts.map(Number))]
}

function neighborPosition(row, pageSize, normalizeCounts = true) {
  if (!row) return { id: null, prevId: null, nextId: null, total: 0, page: 1 }
  return {
    id: Number(row.id),
    prevId: row.prevId ?? null,
    nextId: row.nextId ?? null,
    ordinal: normalizeCounts ? Number(row.ordinal) : row.ordinal,
    total: normalizeCounts ? Number(row.total) : row.total,
    page: Math.ceil(Number(row.page_ordinal ?? row.ordinal) / pageSize),
  }
}

module.exports = { parseNeighborIds, neighborPosition }
