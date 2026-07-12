function omitFilters(filters, keys = []) {
  const omitted = new Set(keys)
  return Object.fromEntries(Object.entries(filters).filter(([key]) => !omitted.has(key)))
}

function buildViewQuery(filters = {}, config = {}) {
  return {
    ...omitFilters(filters, config.omitFilters),
    ...(config.scope || {})
  }
}

async function calculateViewCounts({ filters = {}, views = {}, count }) {
  if (typeof count !== 'function') throw new TypeError('count must be a function')

  const entries = await Promise.all(Object.entries(views).map(async ([key, config = {}]) => {
    const query = buildViewQuery(filters, config)
    return [key, Number(await count(query)) || 0]
  }))

  return Object.fromEntries(entries)
}

module.exports = { buildViewQuery, calculateViewCounts }
