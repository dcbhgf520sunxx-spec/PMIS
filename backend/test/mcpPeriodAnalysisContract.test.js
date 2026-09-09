const assert = require('node:assert/strict')
const test = require('node:test')
const { AjvJsonSchemaValidator } = require('@modelcontextprotocol/sdk/validation/ajv')
const { getToolDefinition, filterToolsForContext, resolvePublicTool } = require('../src/mcp/catalog')
const { validateToolArguments } = require('../src/mcp/dispatcher')
const { analyzeBusinessPeriod } = require('../src/services/mcpPeriodAnalysisService')

const definition = getToolDefinition('business_period_analysis', 'query')
const validator = new AjvJsonSchemaValidator()
const inputValid = validator.getValidator(definition.inputSchema)
const outputValid = validator.getValidator(definition.outputSchema)
const analysisPeriod = { preset: 'custom', start_date: '2026-01-01', end_date: '2026-06-30' }
const context = { endpointType: 'query', allowedMenuPaths: new Set(['/tasks']) }

test('generic analysis discovery and public dispatch retain same-filter detail controls', () => {
  const args = {
    analysis_period: analysisPeriod,
    plan_period: { preset: 'quarter', anchor_date: '2026-07-01' },
    completion_cutoff: '2026-07-20', event_time_basis: 'actual',
    business_types: ['task'],
    filters: { person_ids: [8], person_relation: 'creator' },
    detail_query: { source: 'plan', metric: 'pending', page: 2, page_size: 50, dataset_token: 'a'.repeat(64) },
  }
  const validation = inputValid(args)
  assert.equal(validation.valid, true, validation.errorMessage)
  assert.doesNotThrow(() => validateToolArguments(definition, args))
  assert.deepEqual(resolvePublicTool('business_period_analysis', args, 'query'), {
    name: 'business_period_analysis', args,
  })
  const scoped = filterToolsForContext(context).find((tool) => tool.name === definition.name)
  const scopedValid = validator.getValidator(scoped.inputSchema)
  assert.equal(scopedValid(args).valid, true)
  assert.equal(scopedValid({ ...args, business_types: ['project'] }).valid, false)
  assert.equal(filterToolsForContext({ ...context, allowedMenuPaths: new Set() })
    .some((tool) => tool.name === definition.name), false)
})

test('detail sources require their own metric and bounded numeric pagination', () => {
  const validQueries = [
    { source: 'flow', metric: 'completed' }, { source: 'stock', metric: 'unfinished' },
    { source: 'plan', metric: 'planned' }, { source: 'risk', metric: 'due_soon' },
    { source: 'risk', metric: 'workload_concentration' }, { source: 'people' },
  ]
  for (const detail_query of validQueries) {
    const args = { analysis_period: analysisPeriod, plan_period: analysisPeriod, detail_query }
    const validation = inputValid(args)
    assert.equal(validation.valid, true, validation.errorMessage)
    assert.doesNotThrow(() => validateToolArguments(definition, args))
  }
  for (const detail_query of [
    {}, { source: 'flow' }, { source: 'stock', metric: 'completed' },
    { source: 'plan', metric: 'overdue' }, { source: 'risk', metric: 'created' },
    { source: 'people', metric: 'completed' }, { source: 'people', page: 0 },
    { source: 'people', page_size: 101 }, { source: 'people', page: '2' },
    { source: 'people', page_size: 1.5 }, { source: 'task', metric: 'total' },
  ]) {
    const args = { analysis_period: analysisPeriod, plan_period: analysisPeriod, detail_query }
    assert.equal(inputValid(args).valid, false, JSON.stringify(detail_query))
    assert.throws(() => validateToolArguments(definition, args),
      (error) => error.code === 'MCP_ARGUMENT_INVALID'
        && Object.keys(error.fieldErrors).some((field) => field.startsWith('detail_query')),
      JSON.stringify(detail_query))
  }
})

test('period contracts reject mixed presets, missing dates and invalid person or event bases', () => {
  for (const period of [
    { preset: 'custom', start_date: '2026-01-01' },
    { ...analysisPeriod, anchor_date: '2026-01-01' },
    { ...analysisPeriod, offset: 1 },
    { preset: 'month', start_date: '2026-01-01' },
    { preset: 'day', anchor_date: '2026-02-30' },
  ]) {
    const args = { analysis_period: period }
    assert.equal(inputValid(args).valid, false, JSON.stringify(period))
    assert.throws(() => validateToolArguments(definition, args),
      (error) => error.code === 'MCP_ARGUMENT_INVALID', JSON.stringify(period))
  }
  for (const extra of [
    { event_time_basis: 'updated_at' }, { completion_cutoff: '2026-02-30' },
    { filters: { person_relation: 'owner' } },
  ]) {
    const args = { analysis_period: analysisPeriod, ...extra }
    assert.equal(inputValid(args).valid, false)
    assert.throws(() => validateToolArguments(definition, args), (error) => error.code === 'MCP_ARGUMENT_INVALID')
  }
})

async function emptyAnalysis(extra = {}) {
  const database = { prepare: () => ({ all: async () => [], get: async () => ({}) }) }
  return analyzeBusinessPeriod({ analysis_period: analysisPeriod, ...extra }, context, database, new Date('2026-07-20T02:00:00Z'))
}

test('normal response validates real aggregates and rejects untyped counts or coverage', async () => {
  const result = await emptyAnalysis()
  const validation = outputValid(result)
  assert.equal(validation.valid, true, validation.errorMessage)
  assert.equal(outputValid({ ...result, period_flows: { ...result.period_flows, total: { completed: '4' } } }).valid, false)
  assert.equal(outputValid({ ...result, coverage: { ...result.coverage, statistics_complete: 'yes' } }).valid, false)
  assert.equal(outputValid({ ...result, current_stock: null }).valid, false)
})

test('compact detail output excludes aggregate sections and validates people and candidate items', async () => {
  const result = await emptyAnalysis()
  const compact = {
    resolved_periods: result.resolved_periods, data_cutoff: result.data_cutoff, coverage: result.coverage,
    details: { source: 'people', metric: null, items: [{
      user_id: 8, name: '示例人员', sources: ['creator'], related_record_count: 1, period_operation_count: 0,
    }], total: 1, page: 1, pageSize: 50, totalPages: 1, hasNextPage: false, datasetToken: 'a'.repeat(64) },
  }
  const validation = outputValid(compact)
  assert.equal(validation.valid, true, validation.errorMessage)
  assert.equal(outputValid({ ...result, details: compact.details }).valid, false)
  assert.equal(outputValid({ ...compact, period_flows: result.period_flows }).valid, false)
  assert.equal(outputValid({ ...compact, details: { ...compact.details, total: -1 } }).valid, false)
  assert.equal(outputValid({ ...compact, details: { ...compact.details, items: [{ name: '缺少标识' }] } }).valid, false)
  const task = {
    business_type: 'task', business_type_label: '任务', target_id: 2, name: '待办事项',
    project_name: null, owner_name: '示例人员', status: 1, priority: 2, plan_date: '2026-08-01', overdue_days: 0,
    status_label: '处理中', priority_label: '高', owner_ids: [8],
    project_id: null, requirement_id: null, parent_task_id: null, creator_id: 8, updater_id: null,
    detail_target_id: 2, people: [{ user_id: 8, name: '示例人员', relations: ['business_role', 'creator'] }], is_overdue: false,
  }
  const stock = { ...compact, details: { ...compact.details, source: 'stock', metric: 'unfinished', items: [task] } }
  assert.equal(outputValid(stock).valid, true, outputValid(stock).errorMessage)
  assert.equal(outputValid({ ...stock, details: { ...stock.details, items: [{ ...task, status_label: 1 }] } }).valid, false)
  assert.equal(outputValid({ ...stock, details: { ...stock.details, metric: 'completed' } }).valid, false)
})

test('all compact service response sources satisfy their discovered output contract', async () => {
  for (const detail_query of [
    { source: 'flow', metric: 'completed' }, { source: 'stock', metric: 'unfinished' },
    { source: 'plan', metric: 'pending' }, { source: 'risk', metric: 'due_soon' },
    { source: 'risk', metric: 'workload_concentration' }, { source: 'people' },
  ]) {
    const result = await emptyAnalysis({ plan_period: analysisPeriod, detail_query })
    assert.deepEqual(Object.keys(result).sort(), ['coverage', 'data_cutoff', 'details', 'resolved_periods'])
    const validation = outputValid(result)
    assert.equal(validation.valid, true, validation.errorMessage)
    assert.deepEqual(result.details.items, [])
    assert.equal(result.details.total, 0)
    assert.equal(result.details.source, detail_query.source)
    assert.equal(result.details.metric, detail_query.metric || null)
  }
})
