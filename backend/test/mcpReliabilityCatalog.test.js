const assert = require('node:assert/strict')
const test = require('node:test')
const { AjvJsonSchemaValidator } = require('@modelcontextprotocol/sdk/validation/ajv')
const { getToolDefinition, filterToolsForContext } = require('../src/mcp/catalog')
const { validateToolArguments } = require('../src/mcp/dispatcher')
const { normalizeToolError } = require('../src/mcp/createServer')

const ajv = new AjvJsonSchemaValidator()
const definition = getToolDefinition('business_period_analysis', 'query')
const period = { preset: 'custom', start_date: '2026-09-01', end_date: '2026-09-08' }
const token = 'a'.repeat(64)

function checkBoth(tool, args, valid) {
  const validation = ajv.getValidator(tool.inputSchema)(args)
  assert.equal(validation.valid, valid, validation.errorMessage || JSON.stringify(args))
  if (valid) assert.doesNotThrow(() => validateToolArguments(tool, args))
  else assert.throws(() => validateToolArguments(tool, args), error => error.code === 'MCP_ARGUMENT_INVALID')
}

test('analysis accepts authenticated self scope and rejects ambiguous supplied identities', () => {
  checkBoth(definition, { analysis_period: period, filters: { person_scope: 'self', person_relation: 'business_role' } }, true)
  for (const filters of [
    { person_scope: 'all' }, { person_scope: 'self', person_ids: [8] },
    { person_scope: 'self', person_ids: [] }, { person_scope: 'self', current_user_id: 8 },
  ]) checkBoth(definition, { analysis_period: period, filters }, false)
})

test('detail pages after page one require a well-formed dataset token in both validators', () => {
  const base = { analysis_period: period, detail_query: { source: 'stock', metric: 'unfinished' } }
  for (const pagination of [{}, { page: 1 }, { page: 1, dataset_token: token }, { page: 2, dataset_token: token }]) {
    checkBoth(definition, { ...base, detail_query: { ...base.detail_query, ...pagination } }, true)
  }
  for (const pagination of [{ page: 2 }, { dataset_token: '' }, { dataset_token: 'bad-token' }, { dataset_token: 123 }]) {
    checkBoth(definition, { ...base, detail_query: { ...base.detail_query, ...pagination } }, false)
  }
})

test('stage and work-order queries expose self view without accepting internal user overrides', () => {
  for (const name of ['stage_plan_search', 'work_order_search']) {
    const tool = getToolDefinition(name, 'query')
    checkBoth(tool, { view: 'mine' }, true)
    for (const args of [{ view: 'joined' }, { current_user_id: 8 }, { view_key: 'mine' }, { filter_follower_id: 8 }]) {
      checkBoth(tool, args, false)
    }
    assert.ok(filterToolsForContext({ endpointType: 'query', allowedMenuPaths: new Set(['/projects', '/work-orders']) })
      .find(item => item.name === name).inputSchema.properties.view)
  }
  const output = getToolDefinition('stage_plan_search', 'query').outputSchema.properties.items.items.properties
  for (const field of ['parent_project_status', 'parent_project_status_label', 'collaborators']) assert.ok(output[field], field)
})

test('analysis output documents typed component completeness and dataset token', () => {
  const coverage = definition.outputSchema.properties.coverage.properties
  assert.equal(coverage.event_history_inconsistent_count.type, 'integer')
  const complete = ajv.getValidator(coverage.component_completeness)
  const components = { business_records: true, event_history: null, period_flows: true, current_stock: null,
    plan_outlook: null, report_people: null, financials: null }
  assert.equal(complete(components).valid, true)
  assert.equal(complete({ ...components, event_history: false }).valid, true)
  assert.equal(complete({ ...components, event_history: 'unknown' }).valid, false)
  for (const branch of definition.outputSchema.properties.details.oneOf) {
    assert.equal(branch.properties.datasetToken.pattern, '^[a-f0-9]{64}$')
    assert.ok(branch.required.includes('datasetToken'))
  }
})

test('dataset change has a stable MCP error receipt with actionable field context', () => {
  const error = Object.assign(new Error('查询数据已变化，请从第一页重新查询'), {
    code: 'MCP_DATA_CHANGED', fieldErrors: { 'detail_query.dataset_token': '数据集已变化' },
  })
  assert.deepEqual(normalizeToolError(error, 'fixture-request'), {
    code: 'MCP_DATA_CHANGED', message: error.message, fieldErrors: error.fieldErrors, requestId: 'fixture-request',
  })
})

test('every publicly discoverable tool accepts its error envelope without weakening success schemas', () => {
  const allowedMenuPaths = new Set(['/products', '/projects', '/requirements', '/tasks', '/bugs', '/work-orders'])
  for (const endpointType of ['query', 'action']) {
    const tools = filterToolsForContext({ endpointType, allowedMenuPaths,
      allowedPermissionCodes: new Set(['project_priority_adjust', 'requirement_priority_adjust', 'task_priority_adjust']) })
    assert.ok(tools.length)
    for (const tool of tools) {
      const validate = ajv.getValidator(tool.outputSchema)
      const error = { code: 'MCP_ARGUMENT_INVALID', message: '参数无效', fieldErrors: { field: '字段无效' }, requestId: 'fixture' }
      assert.equal(validate({ error }).valid, true, tool.name)
      assert.equal(validate({ error: { ...error, code: 500 } }).valid, false, tool.name)
      assert.equal(validate({ error: { ...error, fieldErrors: { field: 500 } } }).valid, false, tool.name)
      assert.equal(validate({ error, items: [], success: true }).valid, false, tool.name)
    }
  }
  const searchValid = ajv.getValidator(getToolDefinition('task_search', 'query').outputSchema)
  assert.equal(searchValid({ items: [], total: '0', page: 1, pageSize: 20, totalPages: 0, hasNextPage: false }).valid, false)
})
