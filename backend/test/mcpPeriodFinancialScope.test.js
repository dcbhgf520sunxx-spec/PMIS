const assert = require('node:assert/strict')
const test = require('node:test')
const { analyzeBusinessPeriod } = require('../src/services/mcpPeriodAnalysisService')

const now = new Date('2026-09-08T02:00:00Z')
const args = {
  analysis_period: { preset: 'month', anchor_date: '2026-09-01' },
  plan_period: { preset: 'month', anchor_date: '2026-10-01' },
  business_types: ['project'],
}
const context = { allowedMenuPaths: new Set(['/projects', '/tasks', '/work-orders']) }
const amountFields = [
  'contract_amount', 'planned_payment_amount', 'actual_payment_amount', 'unpaid_amount',
  'period_contract_amount', 'period_actual_payment_amount', 'plan_period_payment_amount',
]

function fixture() {
  const rows = [1, 2].map(id => ({
    business_type: 'project', id, name: `项目 ${id}`, project_id: id,
    product_id: id * 10, requirement_id: id * 100, owner_id: id * 1000,
    owner_ids: [id * 1000], owner_name: `负责人 ${id}`, creator_id: id * 1000,
    status: id, priority: id, plan_date: '2026-09-01', actual_date: null,
    created_at: '2026-08-01 10:00:00+08', is_paused: id === 2, is_completed: false,
    is_overdue: id === 1,
  }))
  const financialQueries = []
  const database = { prepare(sql) {
    const type = /period_analysis:records:([a-z_]+)/.exec(sql)?.[1]
    if (type) return { all: async () => rows.filter(row => row.business_type === type) }
    if (/period_analysis:(logs|people|report_people)/.test(sql)) return { all: async () => [] }
    if (/period_analysis:financials/.test(sql)) return { get: async (...params) => {
      financialQueries.push({ sql, params })
      // Model the external query result, while separately checking its emitted SQL scope below.
      const ids = Array.isArray(params[0]) ? params[0] : [1, 2]
      const selected = [1, 2].filter(id => ids.includes(id))
      return {
        contract_count: selected.length, period_contract_count: selected.length,
        ...Object.fromEntries(amountFields.map(field => [field, String(selected.reduce((sum, id) => sum + id * 100, 0))])),
      }
    } }
    throw new Error(`Unexpected query: ${sql}`)
  } }
  return { rows, financialQueries, database }
}

test('财务查询沿用全部业务筛选后的项目集合，包括空命中', async () => {
  const cases = [
    [{ project_ids: [1] }, [1], 100],
    [{ product_ids: [20] }, [2], 200],
    [{ requirement_ids: [100] }, [1], 100],
    [{ person_ids: [2000], person_relation: 'business_role' }, [2], 200],
    [{ statuses: [1] }, [1], 100],
    [{ priorities: [2] }, [2], 200],
    [{ only_overdue: true }, [1], 100],
    [{ only_paused: true }, [2], 200],
    [{ project_ids: [999] }, [], 0],
    [{ project_ids: [1], person_ids: [2000] }, [], 0],
  ]
  for (const [filters, ids, amount] of cases) {
    const data = fixture()
    const result = await analyzeBusinessPeriod({ ...args, filters }, context, data.database, now)
    assert.equal(result.financials.available, true)
    assert.equal(result.financials.contract_count, ids.length, JSON.stringify(filters))
    assert.equal(result.financials.period_contract_count, ids.length)
    for (const field of amountFields) assert.equal(result.financials[field], amount, `${JSON.stringify(filters)}: ${field}`)
    assert.deepEqual(data.financialQueries[0].params[0], ids)
  }
})

test('只统计授权业务类型关联的项目并去重，不扩大成所有项目', async () => {
  const data = fixture()
  data.rows.push(...[10, 11].map(id => ({ ...data.rows[0], business_type: 'task', id })))
  const result = await analyzeBusinessPeriod({ ...args, business_types: ['task'] }, context, data.database, now)
  assert.equal(result.current_stock.total.total, 2)
  assert.equal(result.financials.contract_count, 1)
  assert.equal(result.financials.contract_amount, 100)
  assert.deepEqual(data.financialQueries[0].params[0], [1])
})

test('没有关联项目的业务集合返回零合同付款而不是全库金额', async () => {
  const data = fixture()
  data.rows.push({ ...data.rows[0], business_type: 'work_order', id: 10, project_id: null })
  const result = await analyzeBusinessPeriod({ ...args, business_types: ['work_order'] }, context, data.database, now)
  assert.equal(result.current_stock.total.total, 1)
  assert.equal(result.financials.contract_count, 0)
  for (const field of amountFields) assert.equal(result.financials[field], 0)
  assert.deepEqual(data.financialQueries[0].params[0], [])
})

test('无项目权限时不查询财务，即便授权任务关联某个项目', async () => {
  const data = fixture()
  data.rows.push({ ...data.rows[0], business_type: 'task', id: 10 })
  const result = await analyzeBusinessPeriod({ ...args, business_types: ['task'] }, {
    allowedMenuPaths: new Set(['/tasks']),
  }, data.database, now)
  assert.deepEqual(result.financials, { available: false })
  assert.equal(data.financialQueries.length, 0)
})

test('财务SQL所有聚合只读取范围内未删除项目、合同、阶段及付款', async () => {
  const data = fixture()
  await analyzeBusinessPeriod(args, context, data.database, now)
  const { sql, params } = data.financialQueries[0]
  assert.match(sql, /WITH scoped_contracts AS/i)
  assert.match(sql, /JOIN pms_project project ON project\.id=contract\.project_id AND project\.is_deleted=0/)
  assert.match(sql, /contract\.is_deleted=0 AND project\.id=ANY\(\?::BIGINT\[\]\)/)
  assert.match(sql, /JOIN scoped_contracts contract ON contract\.id=stage\.contract_id[\s\S]*?WHERE stage\.is_deleted=0/)
  assert.match(sql, /JOIN scoped_stages stage ON stage\.id=payment\.stage_id[\s\S]*?WHERE payment\.is_deleted=0/)
  for (const table of ['pms_project_contract', 'pms_project_payment_stage', 'pms_project_payment_record']) {
    assert.equal(sql.match(new RegExp(`\\b${table}\\b`, 'g')).length, 1, `${table} 不可被绕过范围重复查询`)
  }
  assert.deepEqual(params, [
    [1, 2], '2026-09-01', '2026-09-30', '2026-09-01', '2026-09-30',
    '2026-09-01', '2026-09-30', '2026-10-01', '2026-10-31',
  ])
})
