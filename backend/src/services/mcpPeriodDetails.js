const { createHash } = require('node:crypto')
const { PERIOD_DETAIL_METRICS } = require('./mcpPeriodConstants')

const DETAIL_METRICS = { ...PERIOD_DETAIL_METRICS, people: [] }

function invalid(field, message) {
  return Object.assign(new Error(message), { code: 'MCP_ARGUMENT_INVALID', fieldErrors: { [field]: message } })
}

function validatePeriodDetailQuery(args) {
  const query = args.detail_query
  if (query === undefined) return null
  if (!query || typeof query !== 'object' || Array.isArray(query)) throw invalid('detail_query', '明细查询必须是对象')
  for (const key of Object.keys(query)) {
    if (!['source', 'metric', 'page', 'page_size', 'dataset_token'].includes(key)) throw invalid(`detail_query.${key}`, '不支持的明细查询字段')
  }
  if (!Object.hasOwn(DETAIL_METRICS, query.source)) throw invalid('detail_query.source', '明细来源必须为 flow、stock、plan、risk 或 people')
  if (query.source === 'people' ? query.metric !== undefined : !DETAIL_METRICS[query.source].includes(query.metric)) {
    throw invalid('detail_query.metric', query.source === 'people' ? '人员名单不接受 metric' : `该来源支持的指标：${DETAIL_METRICS[query.source].join('、')}`)
  }
  if (query.source === 'plan' && !args.plan_period) throw invalid('plan_period', '查询计划明细必须提供计划区间')
  if (query.source === 'flow' && args.metrics?.length && !args.metrics.includes(query.metric)) {
    throw invalid('detail_query.metric', '明细指标必须包含在本次 metrics 中，或省略 metrics')
  }
  const page = query.page ?? 1
  const pageSize = query.page_size ?? 50
  if (!Number.isSafeInteger(page) || page < 1) throw invalid('detail_query.page', '页码必须为正整数')
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw invalid('detail_query.page_size', '每页条数必须为 1 至 100 的整数')
  if ((page > 1 || query.dataset_token !== undefined) && !/^[a-f0-9]{64}$/.test(query.dataset_token || '')) {
    throw invalid('detail_query.dataset_token', '续页必须提供首次明细返回的有效 datasetToken')
  }
  return { source: query.source, metric: query.metric ?? null, page, pageSize, datasetToken: query.dataset_token }
}

function canonicalValue(value) {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalValue(value[key])]))
}

function createPeriodDatasetToken(value, entries = [], project = entry => entry) {
  const hash = createHash('sha256').update(JSON.stringify(canonicalValue(value)))
  // Stream small, raw projections; never materialize all enriched candidates or
  // one large canonical copy of all records and historical rich-text fields.
  for (const entry of entries) hash.update('\n').update(JSON.stringify(canonicalValue(project(entry))))
  return hash.digest('hex')
}

function assertPeriodDatasetToken(query, token) {
  if (query.datasetToken && query.datasetToken !== token) {
    throw Object.assign(new Error('业务数据、人员权限或查询口径已变化，请从第一页重新获取完整明细'), {
      code: 'MCP_DATA_CHANGED', fieldErrors: { 'detail_query.dataset_token': '数据集已变化，请重新获取第一页' },
    })
  }
}

function paginatePeriodDetails(query, items, mapItem = item => item) {
  const offset = (query.page - 1) * query.pageSize
  return {
    ...query,
    items: items.slice(offset, offset + query.pageSize).map(mapItem),
    total: items.length,
    totalPages: Math.ceil(items.length / query.pageSize),
    hasNextPage: offset + query.pageSize < items.length,
  }
}

module.exports = { validatePeriodDetailQuery, paginatePeriodDetails, createPeriodDatasetToken, assertPeriodDatasetToken }
