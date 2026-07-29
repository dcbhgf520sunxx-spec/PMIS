const assert = require('node:assert/strict')
const test = require('node:test')

const { getToolDefinition, toolCatalog } = require('../src/mcp/catalog')
const { validateToolArguments } = require('../src/mcp/dispatcher')
const { normalizeToolError } = require('../src/mcp/createServer')
const { decorateQueryResult } = require('../src/mcp/queryTools')

test('every MCP tool publishes described input fields and an output schema', () => {
  assert.equal(toolCatalog.length, 76)
  for (const tool of toolCatalog) {
    assert.ok(tool.description, `${tool.name}缺少工具说明`)
    assert.ok(tool.outputSchema, `${tool.name}缺少输出Schema`)
    for (const [field, schema] of Object.entries(tool.inputSchema?.properties || {})) {
      assert.ok(schema.description, `${tool.name}.${field}缺少字段说明`)
    }
  }
})

test('nested MCP input fields are described and update tools are truly sparse', () => {
  function assertDescribed(schema, path) {
    for (const [field, child] of Object.entries(schema?.properties || {})) {
      assert.ok(child.description, `${path}.${field}缺少字段说明`)
      if (child.type === 'object') assertDescribed(child, `${path}.${field}`)
    }
    if (schema?.items?.type === 'object') assertDescribed(schema.items, `${path}[]`)
  }
  for (const tool of toolCatalog) assertDescribed(tool.inputSchema, tool.name)

  const updateTargets = {
    product_update: ['id'],
    project_update: ['id'],
    requirement_update: ['id'],
    task_update: ['id'],
    bug_update: ['id'],
    work_order_update: ['id'],
    stage_update: ['project_id', 'stage_id'],
    stage_item_update: ['project_id', 'item_id'],
    contract_update: ['project_id'],
    payment_update: ['project_id', 'payment_id'],
  }
  for (const [name, required] of Object.entries(updateTargets)) {
    assert.deepEqual(getToolDefinition(name, 'action').inputSchema.required, required, name)
  }
})

test('fixed business enums publish exact values and Chinese mappings', () => {
  const cases = [
    ['task_search', 'query', 'priority', [0, 1, 2], '0=低，1=中，2=高'],
    ['task_search', 'query', 'source_type', [1, 2], '1=项目，2=需求'],
    ['task_search', 'query', 'status', [0, 1, 2, 3], '0=待处理'],
    ['requirement_search', 'query', 'requirement_type', [1, 2, 3, 4], '1=上会立项'],
    ['bug_search', 'query', 'severity', [1, 2, 3, 4], '4=致命'],
    ['work_order_search', 'query', 'urgency', [0, 1, 2], '1=中'],
    ['project_search', 'query', 'view', ['mine', 'joined'], 'mine=我负责的'],
    ['project_search', 'query', 'sort_order', ['asc', 'desc'], 'asc=升序'],
    ['stage_item_create', 'action', 'requires_delivery_file', [0, 1], '0=不要求'],
    ['task_create', 'action', 'priority', [0, 1, 2], '1=中'],
  ]

  for (const [toolName, endpoint, field, values, description] of cases) {
    const schema = getToolDefinition(toolName, endpoint).inputSchema.properties[field]
    assert.deepEqual(schema.enum, values, `${toolName}.${field}`)
    assert.match(schema.description, new RegExp(description), `${toolName}.${field}`)
  }
})

test('action schemas expose only relevant fields and encode conditional requirements', () => {
  const taskUpdate = getToolDefinition('task_update', 'action').inputSchema
  assert.deepEqual(taskUpdate.required, ['id'])
  assert.equal(taskUpdate.properties.status, undefined)
  assert.equal(taskUpdate.properties.actual_end_date, undefined)
  assert.ok(taskUpdate.properties.priority)
  assert.ok(taskUpdate.allOf?.length)

  const taskStatus = getToolDefinition('task_change_status', 'action').inputSchema
  assert.equal(taskStatus.properties.name, undefined)
  assert.ok(taskStatus.properties.actual_end_date)
  assert.ok(taskStatus.properties.suspend_date)

  const taskCreate = getToolDefinition('task_create', 'action').inputSchema
  assert.ok(taskCreate.allOf?.some((rule) => rule.then?.required?.includes('project_id')))
  assert.ok(taskCreate.allOf?.some((rule) => rule.then?.required?.includes('requirement_id')))
})

test('status schemas publish fields required by each target status', () => {
  const cases = [
    ['task_change_status', 2, ['actual_end_date']],
    ['task_change_status', 3, ['suspend_date']],
    ['requirement_change_status', 33, ['actual_end_date', 'completion_status']],
    ['bug_change_status', 1, ['resolved_date', 'resolution_id']],
    ['work_order_change_status', 2, ['resolve_date', 'result_desc']],
    ['stage_item_change_status', 3, ['pause_reason']],
  ]
  for (const [toolName, status, fields] of cases) {
    const rule = getToolDefinition(toolName, 'action').inputSchema.allOf
      .find((item) => item.if?.properties?.status?.const === status)
    assert.deepEqual(rule?.then?.required, fields, `${toolName}:${status}`)
  }
})

test('task sparse edit accepts only the target and changed field', () => {
  const definition = getToolDefinition('task_update', 'action')
  assert.doesNotThrow(() => validateToolArguments(definition, {
    id: 59,
    priority: 1,
    mode: 'preview',
  }))
})

test('argument errors retain a stable code, field and readable message', () => {
  const definition = getToolDefinition('task_create', 'action')
  let caught
  try {
    validateToolArguments(definition, {
      name: '任务',
      source_type: 1,
      task_type: 2,
      owner_ids: [8],
      priority: 1,
      expected_end_date: '2026-08-31',
      idempotency_key: 'task-create-1',
    })
  } catch (error) {
    caught = normalizeToolError(error)
  }
  assert.deepEqual(caught, {
    code: 'MCP_ARGUMENT_INVALID',
    message: '关联类型为项目时，必须提供关联项目',
    fieldErrors: { project_id: '关联类型为项目时，必须提供关联项目' },
  })
})

test('invalid enum and date errors identify the exact field', () => {
  const definition = getToolDefinition('task_create', 'action')
  assert.throws(
    () => validateToolArguments(definition, {
      name: '任务',
      source_type: 1,
      project_id: 10,
      task_type: 2,
      owner_ids: [8],
      priority: 9,
      expected_end_date: '2026/08/31',
      idempotency_key: 'task-create-1',
    }),
    (error) => error.code === 'MCP_ARGUMENT_INVALID'
      && error.fieldErrors.priority === '优先级必须是：0=低，1=中，2=高'
  )
})

test('query results include readable labels next to business codes', () => {
  const result = decorateQueryResult('task_get', {
    id: 59,
    source_type: 1,
    priority: 1,
    status: 0,
    is_overdue: 0,
  })
  assert.deepEqual(result, {
    id: 59,
    source_type: 1,
    source_type_label: '项目',
    priority: 1,
    priority_label: '中',
    status: 0,
    status_label: '待处理',
    is_overdue: 0,
    is_overdue_label: '未逾期',
    allowed_statuses: [
      { value: 1, label: '处理中' },
      { value: 3, label: '已暂停' },
    ],
  })
})
