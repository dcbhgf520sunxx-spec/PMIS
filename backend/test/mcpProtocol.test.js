const assert = require('node:assert/strict')
const test = require('node:test')

const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js')
const { createMcpServer } = require('../src/mcp/createServer')
const { invokeController } = require('../src/mcp/controllerAdapter')
const { filterToolsForContext } = require('../src/mcp/catalog')
const { createMcpRateLimit, validateMcpOrigin } = require('../src/routes/mcp')
const { validateToolArguments, validateToolPermission } = require('../src/mcp/dispatcher')
const { actions } = require('../src/mcp/actionTools')
const {
  buildGlobalSearchPlan,
  buildProjectSearchInput,
  dispatchQueryTool,
  searchContracts,
  searchPayments,
  searchStagePlans,
} = require('../src/mcp/queryTools')

test('MCP server initializes and exposes only endpoint and menu-permitted tools', async (t) => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const context = {
    endpointType: 'query',
    allowedMenuPaths: new Set(['/projects']),
    user: { id: 8, employeeNo: 'JS001' },
    client: { id: 3 }
  }
  const server = createMcpServer({
    context,
    dispatch: async (name) => ({ name, ok: true })
  })
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  t.after(async () => {
    await client.close()
    await server.close()
  })

  await server.connect(serverTransport)
  await client.connect(clientTransport)
  const result = await client.listTools()
  const names = result.tools.map((tool) => tool.name)

  assert.equal(names.includes('project_search'), true)
  assert.equal(names.includes('project_get'), true)
  assert.equal(names.includes('task_search'), false)
  assert.equal(names.includes('project_create'), false)
})

test('MCP tool failures expose a machine-readable error code and field errors', async (t) => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const context = {
    endpointType: 'action',
    allowedMenuPaths: new Set(['/tasks']),
    user: { id: 8, employeeNo: 'JS001' },
    client: { id: 3 },
  }
  const server = createMcpServer({
    context,
    dispatch: async () => {
      const error = new Error('任务名称已存在')
      error.code = 'MCP_BUSINESS_VALIDATION'
      error.fieldErrors = { name: '任务名称已存在' }
      throw error
    },
  })
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  t.after(async () => {
    await client.close()
    await server.close()
  })

  await server.connect(serverTransport)
  await client.connect(clientTransport)
  const result = await client.callTool({
    name: 'task_delete',
    arguments: { id: 9 },
  })

  assert.equal(result.isError, true)
  assert.deepEqual(result.structuredContent, {
    error: {
      code: 'MCP_BUSINESS_VALIDATION',
      message: '任务名称已存在',
      fieldErrors: { name: '任务名称已存在' },
    },
  })
})

test('MCP tool failures hide raw infrastructure errors behind a stable contract error', async (t) => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const context = {
    endpointType: 'action',
    allowedMenuPaths: new Set(['/tasks']),
    user: { id: 8, employeeNo: 'JS001' },
    client: { id: 3 },
  }
  const server = createMcpServer({
    context,
    dispatch: async () => {
      throw Object.assign(new Error('duplicate key value violates unique constraint secret_name'), {
        code: '23505',
      })
    },
  })
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  t.after(async () => {
    await client.close()
    await server.close()
  })

  await server.connect(serverTransport)
  await client.connect(clientTransport)
  const result = await client.callTool({
    name: 'task_delete',
    arguments: { id: 9 },
  })

  assert.equal(result.isError, true)
  assert.deepEqual(result.structuredContent, {
    error: {
      code: 'MCP_TOOL_ERROR',
      message: 'MCP工具执行失败',
      originalCode: '23505',
    },
  })
  assert.doesNotMatch(result.content[0].text, /secret_name/)
})

test('tool filtering separates Query and Action credentials even with the same menu permissions', () => {
  const allowedMenuPaths = new Set(['/products', '/projects', '/tasks'])
  const queryNames = filterToolsForContext({ endpointType: 'query', allowedMenuPaths }).map((tool) => tool.name)
  const actionNames = filterToolsForContext({ endpointType: 'action', allowedMenuPaths }).map((tool) => tool.name)

  assert.equal(queryNames.includes('task_search'), true)
  assert.equal(queryNames.includes('task_create'), false)
  assert.equal(actionNames.includes('task_create'), true)
  assert.equal(actionNames.includes('task_search'), false)
})

test('controller adapter preserves delegated operator identity and PMIS response envelope', async () => {
  const result = await invokeController(async (req, res) => {
    res.status(200).json({
      code: 0,
      message: 'success',
      data: { operatorId: req.user.id, query: req.query.name }
    })
  }, {
    user: { id: 8, employeeNo: 'JS001' },
    ip: '127.0.0.1',
    requestId: '00000000-0000-4000-8000-000000000001'
  }, {
    query: { name: 'A项目' }
  })

  assert.deepEqual(result.data, { operatorId: 8, query: 'A项目' })
  assert.equal(result.requestId, '00000000-0000-4000-8000-000000000001')
})

test('controller adapter exposes request headers used by existing contract controllers', async () => {
  const result = await invokeController(async (req, res) => {
    res.status(200).json({ code: 0, data: { operationId: req.get('x-operation-id') } })
  }, {
    user: { id: 8, employeeNo: 'JS001' },
    requestId: '00000000-0000-4000-8000-000000000001'
  }, {
    headers: { 'x-operation-id': 'operation-1' }
  })

  assert.equal(result.data.operationId, 'operation-1')
})

test('Origin validation rejects untrusted browser origins and allows non-browser MCP clients', () => {
  assert.doesNotThrow(() => validateMcpOrigin(undefined, ['http://pmis.internal']))
  assert.doesNotThrow(() => validateMcpOrigin('http://pmis.internal', ['http://pmis.internal']))
  assert.throws(() => validateMcpOrigin('http://evil.internal', ['http://pmis.internal']), /Origin/)
})

test('tool schemas reject unknown fields and require business identifiers', () => {
  const context = { endpointType: 'query', allowedMenuPaths: new Set(['/projects']) }
  const definition = require('../src/mcp/catalog').getToolDefinition('project_get', 'query')
  assert.doesNotThrow(() => validateToolArguments(definition, { id: 1 }))
  assert.throws(() => validateToolArguments(definition, {}), /缺少参数/)
  assert.throws(() => validateToolArguments(definition, { id: 1, sql: 'SELECT 1' }), /不支持的参数/)
  assert.equal(filterToolsForContext(context).find((tool) => tool.name === 'project_get').inputSchema.additionalProperties, false)
})

test('global business search tools can be called without filters', () => {
  const catalog = require('../src/mcp/catalog')
  const context = { endpointType: 'query', allowedMenuPaths: new Set(['/projects']) }
  const names = filterToolsForContext(context).map((tool) => tool.name)

  assert.equal(names.includes('global_search'), true)
  assert.equal(names.includes('stage_plan_search'), true)
  assert.equal(names.includes('contract_search'), true)
  for (const name of ['global_search', 'stage_plan_search', 'contract_search', 'payment_search']) {
    const definition = catalog.getToolDefinition(name, 'query')
    assert.doesNotThrow(() => validateToolArguments(definition, {}))
    assert.equal(definition.inputSchema.additionalProperties, false)
  }
})

test('global search builds one zero-filter search per permitted business domain', () => {
  assert.equal(typeof buildGlobalSearchPlan, 'function')
  const context = {
    allowedMenuPaths: new Set(['/products', '/projects', '/tasks']),
    user: { id: 8 },
  }
  assert.deepEqual(buildGlobalSearchPlan({}, context), [
    { name: 'product_search', args: { page_size: 20 } },
    { name: 'project_search', args: { page_size: 20 } },
    { name: 'stage_plan_search', args: { page_size: 20 } },
    { name: 'contract_search', args: { page_size: 20 } },
    { name: 'payment_search', args: { page_size: 20 } },
    { name: 'task_search', args: { page_size: 20 } },
  ])
})

test('global search translates one keyword into each module search field', () => {
  const context = {
    allowedMenuPaths: new Set(['/products', '/requirements', '/bugs', '/work-orders']),
    user: { id: 8 },
  }
  assert.deepEqual(buildGlobalSearchPlan({ keyword: '交付', page_size: 5 }, context), [
    { name: 'product_search', args: { name: '交付', page_size: 5 } },
    { name: 'requirement_search', args: { title: '交付', page_size: 5 } },
    { name: 'bug_search', args: { title: '交付', page_size: 5 } },
    { name: 'work_order_search', args: { problem_desc: '交付', page_size: 5 } },
  ])
})

test('project subdomains expose dedicated global search implementations', () => {
  assert.equal(typeof searchStagePlans, 'function')
  assert.equal(typeof searchContracts, 'function')
  assert.equal(typeof searchPayments, 'function')
})

test('project subdomain searches return paginated records with empty arguments', async () => {
  const rowsByMarker = {
    'pms_project_plan_item': [{ id: 11, project_name: '交付项目', item_name: '上线' }],
    'pms_project_payment_record': [{ id: 13, project_name: '交付项目', payment_amount: '100.00' }],
    'pms_project_contract c': [{ id: 12, project_name: '交付项目', contract_name: '实施合同' }],
  }
  const database = {
    prepare(sql) {
      const marker = sql.includes('SELECT i.id') || sql.includes('total FROM pms_project_plan_item')
        ? 'pms_project_plan_item'
        : sql.includes('SELECT c.id') || sql.includes('total FROM pms_project_contract c')
          ? 'pms_project_contract c'
          : 'pms_project_payment_record'
      return {
        async get() { return { total: marker ? rowsByMarker[marker].length : 0 } },
        async all() { return marker ? rowsByMarker[marker] : [] },
      }
    },
  }

  assert.deepEqual(await searchStagePlans({}, database), {
    items: rowsByMarker.pms_project_plan_item,
    total: 1,
    page: 1,
    pageSize: 20,
  })
  assert.deepEqual(await searchContracts({}, database), {
    items: rowsByMarker['pms_project_contract c'],
    total: 1,
    page: 1,
    pageSize: 20,
  })
  assert.deepEqual(await searchPayments({}, database), {
    items: rowsByMarker.pms_project_payment_record,
    total: 1,
    page: 1,
    pageSize: 20,
  })
})

test('stage plan search uses the real stage and item text columns', async () => {
  const database = {
    prepare(sql) {
      if (sql.includes('i.description')) throw new Error('column i.description does not exist')
      return {
        async get() { return { total: 0 } },
        async all() { return [] },
      }
    },
  }

  await assert.doesNotReject(() => searchStagePlans({ keyword: '交付' }, database))
})

test('global search dispatches every permitted zero-filter search and groups the results', async () => {
  const context = {
    allowedMenuPaths: new Set(['/products', '/tasks']),
    user: { id: 8 },
  }
  const result = await dispatchQueryTool('global_search', {}, context, {
    runTool: async (name, args) => ({ name, pageSize: args.page_size }),
  })

  assert.deepEqual(result, {
    keyword: null,
    results: {
      product_search: { name: 'product_search', pageSize: 20 },
      task_search: { name: 'task_search', pageSize: 20 },
    },
  })
})

test('business analysis requires permission for the requested business domain', () => {
  const definition = require('../src/mcp/catalog').getToolDefinition('business_analyze', 'query')
  const context = { endpointType: 'query', allowedMenuPaths: new Set(['/work-orders']) }

  assert.doesNotThrow(() => validateToolPermission(definition, { domain: 'work_order' }, context))
  assert.throws(
    () => validateToolPermission(definition, { domain: 'payment' }, context),
    /没有该业务模块权限/
  )
})

test('project search maps personal views to the delegated employee scope', () => {
  const context = { user: { id: 8 } }

  assert.deepEqual(
    buildProjectSearchInput({ view: 'mine', page_size: 10 }, context).query,
    { owner_id: 8, current_user_id: 8, pageSize: 10 }
  )
  assert.deepEqual(
    buildProjectSearchInput({ view: 'joined', filter_owner_id: 3 }, context).query,
    { filter_owner_id: 3, joined_user_id: 8, current_user_id: 8 }
  )
})

test('action controller input preserves real business foreign keys', () => {
  const taskInput = actions.task_create[1]({
    mode: 'execute',
    confirmation_id: '00000000-0000-4000-8000-000000000001',
    name: '任务',
    project_id: 12,
    requirement_id: 20,
    owner_ids: [8],
  })
  const stageItemInput = actions.stage_item_create[1]({
    project_id: 12,
    stage_id: 4,
    name: '里程碑',
    owner_id: 8,
    original_due_date: '2026-08-01',
  })

  assert.equal(taskInput.body.project_id, 12)
  assert.equal(taskInput.body.requirement_id, 20)
  assert.equal(stageItemInput.body.stage_id, 4)
  assert.equal(stageItemInput.body.project_id, 12)
})

test('action schemas require complete create inputs and retry-safe idempotency keys', () => {
  const { getToolDefinition } = require('../src/mcp/catalog')
  const cases = [
    ['product_create', { name: '产品', owner_id: 8 }, ['idempotency_key']],
    ['project_create', { name: '项目', product_id: 1, owner_id: 8, expected_end_date: '2026-08-31' }, ['idempotency_key']],
    ['requirement_create', {
      title: '需求', requirement_type: 1, product_id: 1, owner_id: 8,
      submitter_name: '张三', submit_date: '2026-07-28',
    }, ['idempotency_key']],
    ['task_create', {
      name: '任务', source_type: 1, project_id: 1, task_type: 2, owner_ids: [8],
    }, ['idempotency_key']],
    ['bug_create', {
      title: 'BUG', source_type: 1, project_id: 1, bug_type_id: 2, severity: 2, assignee_id: 8,
    }, ['idempotency_key']],
    ['work_order_create', {
      product_id: 1, problem_type: 2, problem_desc: '无法登录', follower_id: 8,
      urgency: 1, expected_resolve_date: '2026-07-29', submitter_name: '张三',
      submitter_dept: '技术部', submit_time: '2026-07-28',
    }, ['idempotency_key']],
    ['stage_create', { project_id: 1, name: '启动' }, ['idempotency_key']],
    ['stage_item_create', {
      project_id: 1, stage_id: 2, name: '上线', owner_id: 8, original_due_date: '2026-08-01',
    }, ['idempotency_key']],
    ['contract_create', {
      project_id: 1, contract_code: 'HT-001', contract_name: '建设合同',
      supplier_id: 3, signed_date: '2026-07-28', contract_amount: 100,
      stages: [{ stage_name: '首付款', planned_amount: 100 }],
    }, ['idempotency_key']],
    ['payment_create', {
      project_id: 1, stage_id: 2, payment_amount: 100,
      payment_month: '2026-07', handler_id: 8,
    }, ['idempotency_key']],
    ['contract_attachment_upload', {
      project_id: 1, file_name: '合同.pdf', content_base64: 'YQ==',
    }, ['idempotency_key']],
  ]

  for (const [name, args, missing] of cases) {
    const definition = getToolDefinition(name, 'action')
    assert.throws(
      () => validateToolArguments(definition, args),
      (error) => error.message === `缺少参数：${missing.join('、')}`,
      name
    )
    assert.doesNotThrow(() => validateToolArguments(definition, {
      ...args,
      idempotency_key: `${name}-20260728-1`,
    }), name)
  }
})

test('action argument validation rejects malformed types, nested values and execute confirmations', () => {
  const { getToolDefinition } = require('../src/mcp/catalog')
  const taskAssign = getToolDefinition('task_assign', 'action')
  const taskCreate = getToolDefinition('task_create', 'action')
  const contractCreate = getToolDefinition('contract_create', 'action')
  const taskDelete = getToolDefinition('task_delete', 'action')

  assert.throws(
    () => validateToolArguments(taskAssign, { ids: '1,2', owner_ids: [8] }),
    /ids参数类型不合法/
  )
  assert.throws(
    () => validateToolArguments(getToolDefinition('product_create', 'action'), {
      name: 123,
      owner_id: 8,
      idempotency_key: 'product-1',
    }),
    /name参数类型不合法/
  )
  assert.throws(
    () => validateToolArguments(getToolDefinition('work_order_create', 'action'), {
      product_id: 1,
      problem_type: 2,
      problem_desc: '无法登录',
      follower_id: 8,
      urgency: true,
      expected_resolve_date: '2026-07-29',
      submitter_name: '张三',
      submitter_dept: '技术部',
      submit_time: '2026-07-28',
      idempotency_key: 'work-order-1',
    }),
    /urgency参数类型不合法/
  )
  assert.throws(
    () => validateToolArguments(taskAssign, { ids: [1, { id: 2 }], owner_ids: [8] }),
    /ids\[1\]参数类型不合法/
  )
  assert.throws(
    () => validateToolArguments(contractCreate, {
      project_id: 1,
      contract_code: 'HT-001',
      contract_name: '建设合同',
      supplier_id: 3,
      signed_date: '2026-07-28',
      contract_amount: 100,
      stages: [{ stage_name: ['错误'], planned_amount: 100 }],
      idempotency_key: 'contract-1',
    }),
    /stages\[0\]\.stage_name参数类型不合法/
  )
  assert.throws(
    () => validateToolArguments(taskCreate, {
      name: '任务',
      source_type: 1,
      project_id: 1,
      task_type: 2,
      owner_ids: [],
      idempotency_key: 'task-1',
    }),
    /owner_ids参数数量不足/
  )
  assert.throws(
    () => validateToolArguments(contractCreate, {
      project_id: 1,
      contract_code: 'HT-001',
      contract_name: '建设合同',
      supplier_id: 3,
      signed_date: '2026-07-28',
      contract_amount: 100,
      stages: [{}],
      idempotency_key: 'contract-1',
    }),
    /缺少参数：stages\[0\]\.stage_name、stages\[0\]\.planned_amount/
  )
  assert.throws(
    () => validateToolArguments(taskDelete, { id: 1, mode: 'execute' }),
    /缺少操作确认号/
  )
  assert.throws(
    () => validateToolArguments(taskDelete, { id: 1, mode: 'execute', confirmation_id: 'not-a-uuid' }),
    /confirmation_id格式不合法/
  )
  assert.throws(
    () => validateToolArguments(
      {
        name: 'future_source_action',
        _meta: { endpointType: 'action', requiresSourceTarget: true },
        inputSchema: {
          type: 'object',
          properties: { source_type: { type: 'number' }, project_id: { type: 'integer' } },
          required: ['source_type'],
          additionalProperties: false,
        },
      },
      { source_type: 1 }
    ),
    /缺少参数：project_id/
  )
  assert.throws(
    () => validateToolArguments(getToolDefinition('stage_item_batch_create', 'action'), {
      project_id: 1,
      stage_id: 2,
      items: [{
        name: '上线',
        owner_id: 8,
        original_due_date: '2026-08-01',
        requires_delivery_file: true,
      }],
      idempotency_key: 'stage-items-1',
    }),
    /items\[0\]\.requires_delivery_file参数类型不合法/
  )
})

test('action tool discovery uses Chinese operation titles and explains two-step confirmation', () => {
  const definition = require('../src/mcp/catalog').getToolDefinition('task_change_status', 'action')
  assert.equal(definition.title, '变更任务状态')
  assert.match(definition.description, /先使用 preview/)
  assert.match(definition.description, /用户确认/)
  assert.match(definition.description, /execute/)
})

test('MCP rate limit isolates clients and rejects requests above the configured window', () => {
  let current = 1000
  const middleware = createMcpRateLimit('action', { limit: 1, windowMs: 100, now: () => current })
  const response = () => ({
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  })
  const first = response()
  middleware({ mcpContext: { client: { id: 1 } }, body: {} }, first, () => { first.next = true })
  const second = response()
  middleware({ mcpContext: { client: { id: 1 } }, body: {} }, second, () => { second.next = true })
  const other = response()
  middleware({ mcpContext: { client: { id: 2 } }, body: {} }, other, () => { other.next = true })
  current += 101
  const reset = response()
  middleware({ mcpContext: { client: { id: 1 } }, body: {} }, reset, () => { reset.next = true })

  assert.equal(first.next, true)
  assert.equal(second.statusCode, 429)
  assert.equal(other.next, true)
  assert.equal(reset.next, true)
})
