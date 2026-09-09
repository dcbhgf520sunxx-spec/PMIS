const assert = require('node:assert/strict')
const test = require('node:test')
const { AjvJsonSchemaValidator } = require('@modelcontextprotocol/sdk/validation/ajv')
const { getToolDefinition, filterToolsForContext, resolvePublicTool } = require('../src/mcp/catalog')
const { validateToolArguments } = require('../src/mcp/dispatcher')
const { analyzeBusinessPeriod } = require('../src/services/mcpPeriodAnalysisService')

const definition = getToolDefinition('business_period_analysis', 'query')
const validator = new AjvJsonSchemaValidator()
const input = validator.getValidator(definition.inputSchema)
const output = validator.getValidator(definition.outputSchema)
const period = { preset: 'custom', start_date: '2026-04-11', end_date: '2026-05-22' }
const context = { endpointType: 'query', user: { id: 8 }, allowedMenuPaths: new Set(['/tasks']) }
const database = { prepare: () => ({ all: async () => [], get: async () => ({}) }) }
const analyze = args => analyzeBusinessPeriod({ analysis_period: period, ...args }, context, database, new Date('2026-09-08T04:00:00Z'))

test('selective sections survive discovery and dispatch without adding report-specific tools', () => {
  const args = { analysis_period: period, business_types: ['task'], sections: ['period_flows', 'current_stock'], metrics: ['created'] }
  const scoped = filterToolsForContext(context).find(tool => tool.name === definition.name)
  for (const tool of [definition, scoped]) {
    const result = validator.getValidator(tool.inputSchema)(args)
    assert.equal(result.valid, true, result.errorMessage)
    assert.doesNotThrow(() => validateToolArguments(tool, args))
  }
  assert.deepEqual(resolvePublicTool(definition.name, args, 'query'), { name: definition.name, args })
})

test('both argument validators reject unknown, repeated and malformed sections', () => {
  for (const sections of [[], ['report_week'], ['current_stock', 'current_stock'], 'current_stock', null, [7]]) {
    const args = { analysis_period: period, sections }
    assert.equal(input(args).valid, false, JSON.stringify(sections))
    assert.throws(() => validateToolArguments(definition, args), error => error.code === 'MCP_ARGUMENT_INVALID', JSON.stringify(sections))
  }
})

test('selective output validates its exact requested blocks and rejects missing or extra blocks', async () => {
  const full = await analyze({ metrics: ['created'] })
  const selected = {
    resolved_periods: full.resolved_periods, data_cutoff: full.data_cutoff,
    coverage: { ...full.coverage, requested_sections: ['period_flows'], section_completeness: { period_flows: true },
      component_completeness: { ...full.coverage.component_completeness, event_history: null, current_stock: null, report_people: null, risk_candidates: null } },
    period_flows: full.period_flows,
  }
  assert.equal(output(selected).valid, true, output(selected).errorMessage)
  const { period_flows: omitted, ...missing } = selected
  assert.ok(omitted)
  assert.equal(output(missing).valid, false)
  assert.equal(output({ ...selected, current_stock: full.current_stock }).valid, false)
  assert.equal(output({ ...selected, period_flows: { ...full.period_flows, total: { created: '0' } } }).valid, false)
  assert.equal(output({ ...selected, coverage: { ...selected.coverage, section_completeness: { period_flows: 'yes' } } }).valid, false)
  assert.equal(output({ ...selected, error: { code: 'MCP_FAILURE', message: '失败' } }).valid, false)
  assert.equal(output(full).valid, true)
  const { current_stock: removedStock, ...brokenFull } = full
  assert.ok(removedStock)
  assert.equal(output(brokenFull).valid, false)
})

test('all selectable blocks and legacy full results follow the same typed output contract', async () => {
  const full = await analyze({ plan_period: period, comparison_period: period, trend_granularity: 'week', group_by: ['business_type'] })
  const sections = ['period_flows', 'current_stock', 'plan_outlook', 'comparison', 'trend', 'groupings',
    'quality_and_delivery', 'financials', 'flow_candidates', 'risk_candidates', 'report_people']
  for (const section of sections) {
    const result = await analyze({ plan_period: period, comparison_period: period, trend_granularity: 'week', group_by: ['business_type'], sections: [section] })
    assert.deepEqual(Object.keys(result).sort(), ['resolved_periods', 'data_cutoff', 'coverage', section].sort())
    if (section === 'financials') {
      assert.equal(result.financials.available, false)
      assert.equal(typeof result.financials.error, 'string')
      assert.equal(result.coverage.statistics_complete, false)
    } else assert.deepEqual(result[section], full[section], section)
    assert.equal(output(result).valid, true, output(result).errorMessage)
  }
  const all = await analyze({ sections, plan_period: period, comparison_period: period, trend_granularity: 'week', group_by: ['business_type'] })
  assert.equal(output(all).valid, true, output(all).errorMessage)
})

test('detail queries retain sections from their originating summary without changing the detail contract', async () => {
  const args = { analysis_period: period, sections: ['current_stock'], detail_query: { source: 'stock', metric: 'total' } }
  assert.equal(input(args).valid, true, input(args).errorMessage)
  assert.doesNotThrow(() => validateToolArguments(definition, args))
  const withSections = await analyze(args)
  const withoutSections = await analyze({ detail_query: args.detail_query })
  assert.deepEqual(withSections, withoutSections)
  assert.equal(output(withSections).valid, true, output(withSections).errorMessage)
})
