const db = require('../db')

const DOMAINS = {
  product: { table: 'pms_product', date: 'created_at', status: 'status', deleted: true },
  project: { table: 'pms_project', date: 'created_at', status: 'status', overdue: 'is_overdue', deleted: true },
  requirement: { table: 'pms_requirement', date: 'created_at', status: 'status', overdue: 'is_overdue', deleted: true },
  task: { table: 'pms_task', date: 'created_at', status: 'status', overdue: 'is_overdue', deleted: true },
  bug: { table: 'pms_bug', date: 'created_at', status: 'status', deleted: true },
  work_order: { table: 'pms_work_order', date: 'created_at', status: 'status', overdue: 'is_overdue', deleted: true },
  contract: { table: 'pms_project_contract', date: 'created_at', deleted: true },
  payment: { table: 'pms_project_payment_record', date: 'created_at', amount: 'payment_amount', deleted: true },
}

async function analyzeBusinessData(args, database = db) {
  const config = DOMAINS[args.domain]
  if (!config) throw new Error('不支持的分析业务域')
  const metric = args.metric || 'count'
  if (!['count', 'overdue_count', 'amount_sum', 'status_distribution'].includes(metric)) throw new Error('不支持的分析指标')
  if (metric === 'overdue_count' && !config.overdue) throw new Error('该业务域没有逾期指标')
  if (metric === 'amount_sum' && !config.amount) throw new Error('该业务域没有金额指标')

  const params = []
  const where = []
  if (config.deleted) where.push('is_deleted = 0')
  if (args.date_from) { where.push(`${config.date} >= ?`); params.push(args.date_from) }
  if (args.date_to) { where.push(`${config.date} < ?::date + INTERVAL '1 day'`); params.push(args.date_to) }
  if (args.status !== undefined) {
    if (!config.status) throw new Error('该业务域没有状态字段')
    where.push(`${config.status} = ?`)
    params.push(Number(args.status))
  }
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : ''
  let sql
  if (metric === 'status_distribution') {
    if (!config.status) throw new Error('该业务域没有状态字段')
    sql = `SELECT ${config.status} status, COUNT(*)::INTEGER value FROM ${config.table}${clause} GROUP BY ${config.status} ORDER BY ${config.status}`
  } else {
    const expression = metric === 'count' ? 'COUNT(*)::INTEGER'
      : metric === 'overdue_count' ? `COUNT(*) FILTER (WHERE ${config.overdue} = 1)::INTEGER`
        : `COALESCE(SUM(${config.amount}), 0)::NUMERIC`
    sql = `SELECT ${expression} value FROM ${config.table}${clause}`
  }
  const rows = await database.prepare(sql).all(...params)
  return {
    domain: args.domain,
    metric,
    scope: { dateFrom: args.date_from || null, dateTo: args.date_to || null, status: args.status ?? null },
    definition: metric === 'amount_sum' ? '有效记录金额合计' : metric === 'overdue_count' ? '有效记录中逾期标记为1的数量' : '有效记录数量',
    results: rows,
  }
}

module.exports = { DOMAINS, analyzeBusinessData }
