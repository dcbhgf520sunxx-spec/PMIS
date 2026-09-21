const db = require('../db')
const { overdueSql } = require('./overdueRules')


const DOMAINS = {
  product: {
    label: '产品', table: 'pms_product', date: 'created_at', status: 'status', statuses: [0, 1],
    metrics: ['count', 'status_distribution'], deleted: true,
  },
  project: {
    label: '项目', table: 'pms_project', date: 'created_at', status: 'status', statuses: [0, 1, 2, 3],
    overdue: overdueSql('project').predicate,
    metrics: ['count', 'overdue_count', 'status_distribution'], deleted: true,
  },
  requirement: {
    label: '需求', table: 'pms_requirement', date: 'created_at', status: 'status',
    statuses: [0, 1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 30, 31, 32, 33, 34, 35],
    overdue: overdueSql('requirement').predicate,
    metrics: ['count', 'overdue_count', 'status_distribution'], deleted: true,
  },
  task: {
    label: '任务', table: 'pms_task', date: 'created_at', status: 'status', statuses: [0, 1, 2, 3],
    overdue: overdueSql('task').predicate,
    metrics: ['count', 'overdue_count', 'status_distribution'], deleted: true,
  },
  bug: {
    label: 'BUG', table: 'pms_bug', date: 'created_at', status: 'status', statuses: [0, 1, 2, 3],
    metrics: ['count', 'status_distribution'], deleted: true,
  },
  work_order: {
    label: '工单', table: 'pms_work_order', date: 'created_at', status: 'status', statuses: [0, 1, 2, 4, 5],
    overdue: overdueSql('work_order').predicate,
    metrics: ['count', 'overdue_count', 'status_distribution'], deleted: true,
  },
  contract: {
    label: '合同', table: 'pms_project_contract', date: 'created_at', amount: 'contract_amount',
    metrics: ['count', 'amount_sum'], deleted: true,
  },
  payment: {
    label: '付款', table: 'pms_project_payment_record', date: 'created_at', amount: 'payment_amount',
    metrics: ['count', 'amount_sum'], deleted: true,
  },
}

function argumentError(field, message) {
  const error = new Error(message)
  error.code = 'MCP_ARGUMENT_INVALID'
  error.fieldErrors = { [field]: message }
  return error
}

async function analyzeBusinessData(args, database = db) {
  const config = DOMAINS[args.domain]
  if (!config) throw argumentError('domain', `不支持的分析业务域：${args.domain}`)
  const metric = args.metric || 'count'
  if (!config.metrics.includes(metric)) {
    const metricLabels = {
      overdue_count: '逾期数量统计',
      amount_sum: '金额合计统计',
      status_distribution: '状态分布统计',
    }
    throw argumentError('metric', `${config.label}不支持${metricLabels[metric] || `统计指标：${metric}`}`)
  }
  if (args.status !== undefined && !config.status) {
    throw argumentError('status', `${config.label}不支持状态筛选`)
  }
  if (args.status !== undefined && !config.statuses.includes(Number(args.status))) {
    throw argumentError('status', `${config.label}状态可选值为：${config.statuses.join('、')}`)
  }

  const params = []
  const where = []
  if (config.deleted) where.push('is_deleted = 0')
  if (args.date_from) { where.push(`${config.date} >= ?`); params.push(args.date_from) }
  if (args.date_to) { where.push(`${config.date} < ?::date + INTERVAL '1 day'`); params.push(args.date_to) }
  if (args.status !== undefined) {
    where.push(`${config.status} = ?`)
    params.push(Number(args.status))
  }
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : ''
  let sql
  if (metric === 'status_distribution') {
    sql = `SELECT ${config.status} status, COUNT(*)::INTEGER value FROM ${config.table}${clause} GROUP BY ${config.status} ORDER BY ${config.status}`
  } else {
    const expression = metric === 'count' ? 'COUNT(*)::INTEGER'
      : metric === 'overdue_count' ? `COUNT(*) FILTER (WHERE ${config.overdue})::INTEGER`
        : `COALESCE(SUM(${config.amount}), 0)::NUMERIC`
    sql = `SELECT ${expression} value FROM ${config.table}${clause}`
  }
  const rows = await database.prepare(sql).all(...params)
  return {
    domain: args.domain,
    metric,
    scope: { dateFrom: args.date_from || null, dateTo: args.date_to || null, status: args.status ?? null },
    definition: metric === 'amount_sum'
      ? '有效记录金额合计'
      : metric === 'overdue_count'
        ? '筛选范围内按当前业务状态与计划日期实时计算的逾期数量（上海当天，排除终态及暂停；日期筛选按创建时间）'
        : metric === 'status_distribution'
          ? '有效记录按状态分组的数量'
          : '有效记录数量',
    results: rows,
  }
}

module.exports = { DOMAINS, analyzeBusinessData }
