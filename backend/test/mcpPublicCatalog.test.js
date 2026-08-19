const assert = require('node:assert/strict')
const test = require('node:test')

const {
  filterToolsForContext,
  getToolDefinition,
  publicToolCatalog,
  resolvePublicTool,
} = require('../src/mcp/catalog')
const { buildExecutePayload } = require('../src/mcp/dispatcher')

const allMenus = new Set(['/products', '/projects', '/requirements', '/tasks', '/bugs', '/work-orders'])

test('public MCP catalog exposes 15 query tools and 19 action tools', () => {
  const query = filterToolsForContext({ endpointType: 'query', allowedMenuPaths: allMenus })
  const action = filterToolsForContext({ endpointType: 'action', allowedMenuPaths: allMenus })

  assert.equal(query.length, 15)
  assert.equal(action.length, 19)
  assert.deepEqual(query.map((tool) => tool.name), [
    'global_search',
    'business_attachment_search',
    'product_search',
    'project_search',
    'stage_plan_search',
    'contract_search',
    'payment_search',
    'requirement_search',
    'task_search',
    'bug_search',
    'work_order_search',
    'business_options',
    'business_get',
    'business_history',
    'business_analyze',
  ])
  assert.deepEqual(action.map((tool) => tool.name), [
    'product_manage',
    'product_status',
    'project_manage',
    'project_status',
    'requirement_manage',
    'requirement_status',
    'task_manage',
    'task_flow',
    'bug_manage',
    'bug_flow',
    'work_order_manage',
    'work_order_flow',
    'stage_manage',
    'stage_item_manage',
    'stage_item_flow',
    'contract_manage',
    'payment_manage',
    'contract_attachment_manage',
    'stage_delivery_manage',
  ])
  assert.equal(query.some((tool) => tool.name === 'task_get'), false)
  assert.equal(action.some((tool) => tool.name === 'task_update'), false)
})

test('public task action resolves to the existing internal command without operation leakage', () => {
  assert.deepEqual(resolvePublicTool('task_manage', {
    operation: 'update',
    id: 59,
    description: '更新说明',
    mode: 'preview',
  }, 'action'), {
    name: 'task_update',
    args: {
      id: 59,
      description: '更新说明',
      mode: 'preview',
    },
  })
})

test('preview exposes a directly reusable execute payload for the same public action', () => {
  const result = buildExecutePayload('task_manage', { operation: 'update' }, {
    confirmationId: '00000000-0000-4000-8000-000000000001',
    resultStatus: 'preview',
    executeArguments: {
      id: 59,
      description: '更新说明',
      owner_ids: [8],
      mode: 'execute',
      confirmation_id: '00000000-0000-4000-8000-000000000001',
    },
  })

  assert.deepEqual(result.execute_payload, {
    tool_name: 'task_manage',
    arguments: {
      operation: 'update',
      id: 59,
      description: '更新说明',
      owner_ids: [8],
      mode: 'execute',
      confirmation_id: '00000000-0000-4000-8000-000000000001',
    },
  })
  assert.equal('executeArguments' in result, false)
})

test('all action schemas require an explicit mode', () => {
  for (const tool of filterToolsForContext({
    endpointType: 'action',
    allowedMenuPaths: allMenus,
    allowedPermissionCodes: new Set([
      'project_priority_adjust',
      'requirement_priority_adjust',
      'task_priority_adjust',
    ]),
  })) {
    for (const branch of tool.inputSchema.oneOf || []) {
      assert.ok(branch.required.includes('mode'), `${tool.name} must require mode`)
    }
  }
})

test('优先级 MCP 使用独立工具并按按钮权限精确暴露', () => {
  const context = {
    endpointType: 'action',
    allowedMenuPaths: allMenus,
    allowedPermissionCodes: new Set([
      'project_priority_adjust',
      'requirement_priority_adjust',
      'task_priority_adjust',
    ]),
  }
  const names = filterToolsForContext(context).map((tool) => tool.name)
  assert.ok(names.includes('project_priority'))
  assert.ok(names.includes('requirement_priority'))
  assert.ok(names.includes('task_priority'))
  assert.equal(filterToolsForContext({
    ...context,
    allowedPermissionCodes: new Set(['task_priority_adjust']),
  }).some((tool) => tool.name === 'project_priority'), false)

  assert.deepEqual(resolvePublicTool('task_priority', {
    operation: 'change_priority', id: 59, priority: 2, mode: 'preview',
  }, 'action'), {
    name: 'task_change_priority',
    args: { id: 59, priority: 2, mode: 'preview' },
  })
})

test('generic detail and history tools normalize one target id to internal query commands', () => {
  assert.deepEqual(resolvePublicTool('business_get', {
    domain: 'task',
    target_id: 59,
  }, 'query'), {
    name: 'task_get',
    args: { id: 59 },
  })
  assert.deepEqual(resolvePublicTool('business_history', {
    domain: 'stage_plan',
    target_id: 12,
  }, 'query'), {
    name: 'stage_plan_history',
    args: { project_id: 12 },
  })
})

test('generic query domains are reduced to the current employee menu permissions', () => {
  const tools = filterToolsForContext({
    endpointType: 'query',
    allowedMenuPaths: new Set(['/projects']),
  })
  assert.deepEqual(
    tools.find((tool) => tool.name === 'business_get').inputSchema.properties.domain.enum,
    ['project', 'stage_plan', 'contract']
  )
  assert.deepEqual(
    tools.find((tool) => tool.name === 'business_history').inputSchema.properties.domain.enum,
    ['project', 'stage_plan']
  )
})

test('public action metadata describes operation branches and status-specific fields', () => {
  const taskFlow = getToolDefinition('task_flow', 'action').inputSchema
  assert.deepEqual(taskFlow.properties.operation.enum, ['assign', 'change_status'])
  assert.ok(taskFlow.oneOf.some((branch) => branch.properties.operation.const === 'assign'
    && branch.required.includes('ids')
    && branch.required.includes('owner_ids')))
  const statusBranch = taskFlow.oneOf.find((branch) => branch.properties.operation.const === 'change_status')
  assert.ok(statusBranch.allOf.some((rule) => rule.if?.properties?.status?.const === 2
    && rule.then.required.includes('actual_end_date')))
})

test('every public tool and operation branch has complete metadata', () => {
  assert.equal(publicToolCatalog.length, 38)
  for (const tool of publicToolCatalog) {
    assert.ok(tool.title, `${tool.name}缺少标题`)
    assert.ok(tool.description, `${tool.name}缺少说明`)
    assert.ok(tool.outputSchema?.description, `${tool.name}缺少输出说明`)
    for (const [field, schema] of Object.entries(tool.inputSchema?.properties || {})) {
      assert.ok(schema.description, `${tool.name}.${field}缺少字段说明`)
    }
    for (const branch of tool.inputSchema?.oneOf || []) {
      assert.ok(branch.title, `${tool.name}存在未命名的operation分支`)
      if (branch.properties?.operation) {
        assert.ok(branch.properties.operation.description, `${tool.name}存在未说明的operation分支`)
      }
      assert.equal(branch.additionalProperties, false, `${tool.name}.${branch.properties?.operation?.const || branch.title}允许混入其他字段`)
      for (const [field, schema] of Object.entries(branch.properties || {})) {
        assert.ok(schema.description, `${tool.name}.${branch.properties?.operation?.const || branch.title}.${field}缺少字段说明`)
      }
    }
  }
})

test('项目查询支持优先级筛选、排序和中文返回契约', () => {
  const projectSearch = getToolDefinition('project_search', 'query')
  assert.deepEqual(projectSearch.inputSchema.properties.priority.enum, [0, 1, 2])
  assert.ok(projectSearch.inputSchema.properties.sort_field.enum.includes('priority'))
  assert.ok(projectSearch.outputSchema.properties.items.items.properties.priority)
  assert.ok(projectSearch.outputSchema.properties.items.items.properties.priority_label)
})

test('business option types are reduced to the current employee menu permissions', () => {
  const taskTools = filterToolsForContext({
    endpointType: 'query',
    allowedMenuPaths: new Set(['/tasks']),
  })
  assert.deepEqual(
    taskTools.find((tool) => tool.name === 'business_options').inputSchema.properties.option_type.enum,
    ['user', 'task_type']
  )

  const projectTools = filterToolsForContext({
    endpointType: 'query',
    allowedMenuPaths: new Set(['/projects']),
  })
  assert.deepEqual(
    projectTools.find((tool) => tool.name === 'business_options').inputSchema.properties.option_type.enum,
    ['user', 'supplier']
  )
})

test('permission scoping removes generic tools when no permitted domain remains', () => {
  const tools = filterToolsForContext({
    endpointType: 'query',
    allowedMenuPaths: new Set(['/unknown-menu']),
  })

  assert.equal(tools.some((tool) => tool.name === 'business_get'), false)
  assert.equal(tools.some((tool) => tool.name === 'business_history'), false)
  assert.equal(tools.some((tool) => tool.name === 'business_analyze'), false)
  assert.deepEqual(
    tools.find((tool) => tool.name === 'business_options').inputSchema.properties.option_type.enum,
    ['user']
  )
})

test('personal view metadata only exposes views implemented by each module', () => {
  assert.deepEqual(getToolDefinition('project_search', 'query').inputSchema.properties.view.enum, ['mine', 'joined'])
  for (const name of ['requirement_search', 'task_search', 'bug_search']) {
    assert.deepEqual(getToolDefinition(name, 'query').inputSchema.properties.view.enum, ['mine'], name)
  }
})

test('search metadata publishes one snake_case sort contract and accepts ID arrays', () => {
  const projectSearch = getToolDefinition('project_search', 'query')
  assert.ok(projectSearch.inputSchema.properties.sort_field.enum.includes('expected_end_date'))
  assert.equal(projectSearch.inputSchema.properties.sort_field.enum.includes('expectedEndDate'), false)

  for (const name of [
    'product_search', 'project_search', 'requirement_search', 'task_search', 'bug_search',
    'work_order_search', 'stage_plan_search', 'contract_search', 'payment_search',
  ]) {
    const values = getToolDefinition(name, 'query').inputSchema.properties.sort_field.enum
    assert.ok(values.length > 0, `${name}缺少排序字段元数据`)
    assert.equal(values.some((value) => /[A-Z]/.test(value)), false, `${name}仍暴露camelCase排序字段`)
  }

  assert.throws(
    () => require('../src/mcp/dispatcher').validateToolArguments(projectSearch, { sort_field: 'anything' }),
    (error) => error.code === 'MCP_ARGUMENT_INVALID' && Boolean(error.fieldErrors.sort_field)
  )

  const productSearch = getToolDefinition('product_search', 'query')
  assert.doesNotThrow(() => require('../src/mcp/dispatcher').validateToolArguments(productSearch, {
    owner_ids: [8, 9],
  }))
})

test('public ID metadata rejects names and no longer references hidden tools', () => {
  const businessGet = getToolDefinition('business_get', 'query')
  assert.throws(
    () => require('../src/mcp/dispatcher').validateToolArguments(businessGet, {
      domain: 'task',
      target_id: '孙鑫鑫',
    }),
    (error) => error.code === 'MCP_ARGUMENT_INVALID' && Boolean(error.fieldErrors.target_id)
  )
  assert.doesNotMatch(
    getToolDefinition('stage_item_manage', 'action').inputSchema.properties.stage_id.description,
    /stage_plan_get/
  )
})

test('business analysis metadata publishes exact domain and metric compatibility', () => {
  const schema = getToolDefinition('business_analyze', 'query').inputSchema
  const contract = schema.oneOf.find((branch) => branch.properties.domain.const === 'contract')
  const workOrder = schema.oneOf.find((branch) => branch.properties.domain.const === 'work_order')
  const requirement = schema.oneOf.find((branch) => branch.properties.domain.const === 'requirement')

  assert.deepEqual(contract.properties.metric.enum, ['count', 'amount_sum'])
  assert.deepEqual(workOrder.properties.status.enum, [0, 1, 2, 4, 5])
  assert.ok(requirement.properties.status.enum.includes(35))
  assert.doesNotThrow(() => require('../src/mcp/dispatcher').validateToolArguments(
    getToolDefinition('business_analyze', 'query'),
    { domain: 'requirement', metric: 'count', status: 35 }
  ))
})

test('business option permission is enforced even when a hidden option type is called directly', () => {
  const { validateToolPermission } = require('../src/mcp/dispatcher')
  const definition = getToolDefinition('business_options', 'query')
  assert.throws(
    () => validateToolPermission(definition, { option_type: 'bug_type' }, {
      allowedMenuPaths: new Set(['/tasks']),
    }),
    (error) => error.code === 'MCP_PERMISSION_DENIED'
  )
  assert.throws(
    () => validateToolPermission(definition, { option_type: 'user' }, {
      allowedMenuPaths: new Set(),
    }),
    (error) => error.code === 'MCP_PERMISSION_DENIED'
  )
})

test('priority actions require their independent button permission', () => {
  const { validateToolPermission } = require('../src/mcp/dispatcher')
  const definition = getToolDefinition('task_change_priority', 'action')
  assert.throws(
    () => validateToolPermission(definition, { id: 59, priority: 1 }, {
      allowedMenuPaths: new Set(['/tasks']),
      allowedPermissionCodes: new Set(),
    }),
    (error) => error.code === 'MCP_PERMISSION_DENIED'
  )
  assert.doesNotThrow(() => validateToolPermission(definition, { id: 59, priority: 1 }, {
    allowedMenuPaths: new Set(['/tasks']),
    allowedPermissionCodes: new Set(['task_priority_adjust']),
  }))
})

test('invalid public operation returns an exact field error', () => {
  assert.throws(
    () => resolvePublicTool('task_manage', {
      operation: 'change_status',
      id: 59,
      status: 2,
      mode: 'preview',
    }, 'action'),
    (error) => error.code === 'MCP_ARGUMENT_INVALID'
      && error.fieldErrors.operation === 'operation 与当前工具不匹配'
  )
})
