const assert = require('node:assert/strict')
const test = require('node:test')
const { getPublicToolDefinition, getToolDefinition, filterToolsForContext } = require('../src/mcp/catalog')
const { validateToolArguments, validateToolPermission } = require('../src/mcp/dispatcher')

const analysis = getToolDefinition('business_period_analysis', 'query')
const period = { preset: 'custom', start_date: '2026-08-01', end_date: '2026-08-31' }

function expectFieldError(definition, args, path) {
  assert.throws(() => validateToolArguments(definition, args), (error) => {
    assert.equal(error.code, 'MCP_ARGUMENT_INVALID')
    assert.ok(error.fieldErrors?.[path], `${path}: ${JSON.stringify(error.fieldErrors)}`)
    return true
  })
}

test('nested period branches enforce required and forbidden fields at their full paths', () => {
  for (const field of ['analysis_period', 'comparison_period', 'plan_period', 'risk_period']) {
    for (const [value, invalidField] of [
      [{ preset: 'custom', start_date: '2026-08-01' }, 'end_date'],
      [{ ...period, anchor_date: '2026-08-01' }, 'anchor_date'],
      [{ ...period, offset: 1 }, 'offset'],
      [{ preset: 'week', start_date: '2026-08-01' }, 'start_date'],
      [{ preset: 'month', end_date: '2026-08-31' }, 'end_date'],
    ]) {
      expectFieldError(analysis, { analysis_period: period, [field]: value }, `${field}.${invalidField}`)
    }
    assert.doesNotThrow(() => validateToolArguments(analysis, {
      analysis_period: period, [field]: { preset: 'month', anchor_date: '2026-08-01', offset: -1 },
    }))
  }
})

test('nested detail branches reject metrics from other sources and preserve the exact error path', () => {
  for (const detail_query of [
    { source: 'flow' }, { source: 'stock', metric: 'completed' },
    { source: 'plan', metric: 'overdue' }, { source: 'risk', metric: 'created' },
    { source: 'people', metric: 'completed' },
  ]) {
    expectFieldError(analysis, {
      analysis_period: period, plan_period: period, detail_query,
    }, 'detail_query.metric')
  }
  expectFieldError(analysis, { analysis_period: period, detail_query: {} }, 'detail_query.source')
  expectFieldError(analysis, {
    analysis_period: period, detail_query: { source: 'unknown' },
  }, 'detail_query.source')
})

test('nested plan condition does not require a plan period for unrelated detail sources', () => {
  for (const detail_query of [
    { source: 'flow', metric: 'completed' }, { source: 'stock', metric: 'unfinished' },
    { source: 'risk', metric: 'due_soon' }, { source: 'people' },
  ]) {
    assert.doesNotThrow(() => validateToolArguments(analysis, { analysis_period: period, detail_query }))
  }
  expectFieldError(analysis, {
    analysis_period: period, detail_query: { source: 'plan', metric: 'pending' },
  }, 'plan_period')
  expectFieldError(analysis, {
    analysis_period: period, completion_cutoff: '2026-08-31',
  }, 'plan_period')
})

test('nested allOf applies only the matching then or else constraints recursively', () => {
  const definition = {
    inputSchema: { properties: { rows: { type: 'array', items: {
      type: 'object',
      properties: { kind: { enum: ['dated', 'plain'] }, date: { type: 'string' } },
      required: ['kind'],
      allOf: [{
        if: { properties: { kind: { const: 'dated' } }, required: ['kind'] },
        then: { required: ['date'], properties: { date: { format: 'date' } } },
        else: { properties: { date: false } },
      }],
    } } } },
  }
  assert.doesNotThrow(() => validateToolArguments(definition, { rows: [
    { kind: 'dated', date: '2026-08-31' }, { kind: 'plain' },
  ] }))
  expectFieldError(definition, { rows: [{ kind: 'dated' }] }, 'rows[0].date')
  expectFieldError(definition, { rows: [{ kind: 'dated', date: '2026-02-30' }] }, 'rows[0].date')
  expectFieldError(definition, { rows: [{ kind: 'plain', date: '2026-08-31' }] }, 'rows[0].date')
})

test('false schemas reject supplied values in properties and array items but allow omission', () => {
  const definition = { inputSchema: { properties: {
    blocked: false,
    rows: { type: 'array', items: false },
    record: { type: 'object', properties: { blocked: false, open: true } },
  } } }
  assert.doesNotThrow(() => validateToolArguments(definition, { rows: [], record: { open: 1 } }))
  expectFieldError(definition, { blocked: null }, 'blocked')
  expectFieldError(definition, { rows: [null] }, 'rows[0]')
  expectFieldError(definition, { record: { blocked: false } }, 'record.blocked')
})

test('nested oneOf validates exactly one branch without inheriting allowed sibling fields', () => {
  const definition = { inputSchema: { properties: { value: {
    oneOf: [{ type: 'integer', minimum: 1 }, { type: 'number', maximum: 10 }],
  } } } }
  assert.doesNotThrow(() => validateToolArguments(definition, { value: 11 }))
  assert.doesNotThrow(() => validateToolArguments(definition, { value: 0.5 }))
  expectFieldError(definition, { value: 2 }, 'value')
  expectFieldError(definition, { value: 'wrong' }, 'value')
})

test('nested validation retains public Action sparse updates and scoped Query permission denial', () => {
  assert.doesNotThrow(() => validateToolArguments(getPublicToolDefinition('task_manage', 'action'), {
    operation: 'update', mode: 'preview', id: 59, description: '更新说明',
  }))
  const context = { endpointType: 'query', allowedMenuPaths: new Set(['/tasks']) }
  const scoped = filterToolsForContext(context).find((tool) => tool.name === 'business_period_analysis')
  assert.doesNotThrow(() => validateToolArguments(scoped, { analysis_period: period, business_types: ['task'] }))
  expectFieldError(scoped, { analysis_period: period, business_types: ['project'] }, 'business_types[0]')
  assert.throws(() => validateToolPermission(getToolDefinition('project_search', 'query'), {}, context),
    (error) => error.code === 'MCP_PERMISSION_DENIED')
})

test('period analysis direct calls require at least one authorized requested business type', () => {
  for (const context of [
    { allowedMenuPaths: new Set() }, { allowedMenuPaths: new Set(['/products']) },
  ]) assert.throws(() => validateToolPermission(analysis, {}, context), error => error.code === 'MCP_PERMISSION_DENIED')
  const context = { allowedMenuPaths: new Set(['/tasks']) }
  assert.throws(() => validateToolPermission(analysis, { business_types: ['project'] }, context), error => error.code === 'MCP_PERMISSION_DENIED')
  assert.doesNotThrow(() => validateToolPermission(analysis, { business_types: ['project', 'task'] }, context))
})
