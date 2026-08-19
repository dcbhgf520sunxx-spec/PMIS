const assert = require('node:assert/strict')
const test = require('node:test')

const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js')
const { createMcpServer } = require('../src/mcp/createServer')
const { invokeController } = require('../src/mcp/controllerAdapter')
const { filterToolsForContext } = require('../src/mcp/catalog')
const { createFileDownloadHandler, createMcpRateLimit, validateMcpOrigin } = require('../src/routes/mcp')
const { validateToolArguments, validateToolPermission } = require('../src/mcp/dispatcher')
const { actions } = require('../src/mcp/actionTools')
const {
  buildGlobalSearchPlan,
  buildProjectSearchInput,
  dispatchQueryTool,
  searchBusinessAttachments,
  searchContracts,
  searchPayments,
  searchStagePlans,
} = require('../src/mcp/queryTools')

test('temporary file download rechecks active employee permissions and redirects to a fresh signed URL', async () => {
  const response = {
    statusCode: 200,
    headers: {},
    set(name, value) { this.headers[name] = value; return this },
    status(code) { this.statusCode = code; return this },
    json(value) { this.body = value; return this },
    redirect(code, location) { this.statusCode = code; this.headers.Location = location; return this },
  }
  const handler = createFileDownloadHandler({
    verifyToken: () => ({ uri: 'pmis://projects/12/contract/attachments/34', userId: 8 }),
    database: { prepare: () => ({ get: async () => ({ id: 8, status: 1, is_deleted: 0 }) }) },
    permissionService: { getAllowedMenuPaths: async () => new Set(['/projects']) },
    loadDescriptor: async () => ({ fileUrl: 'https://pmis.example.com/api/files/oss?signed=1' }),
  })

  await handler({ params: { token: 'signed-token' } }, response)

  assert.equal(response.statusCode, 302)
  assert.equal(response.headers.Location, 'https://pmis.example.com/api/files/oss?signed=1')
  assert.equal(response.headers['Cache-Control'], 'private, no-store')
})

test('temporary file download rejects disabled employees before resolving a file URL', async () => {
  let loaded = false
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(value) { this.body = value; return this },
  }
  const handler = createFileDownloadHandler({
    verifyToken: () => ({ uri: 'pmis://projects/12/contract/attachments/34', userId: 8 }),
    database: { prepare: () => ({ get: async () => ({ id: 8, status: 0, is_deleted: 0 }) }) },
    permissionService: { getAllowedMenuPaths: async () => new Set(['/projects']) },
    loadDescriptor: async () => { loaded = true },
  })

  await handler({ params: { token: 'signed-token' } }, response)

  assert.equal(response.statusCode, 403)
  assert.equal(loaded, false)
})

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
  assert.equal(names.includes('business_get'), true)
  assert.equal(names.includes('task_search'), false)
  assert.equal(names.includes('project_manage'), false)
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

test('MCP errors return a request id and readable diagnostic text', async (t) => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const context = {
    endpointType: 'action',
    allowedMenuPaths: new Set(['/tasks']),
    user: { id: 8, employeeNo: 'JS001' },
    client: { id: 3 },
    auditRequestId: 'mcp-request-20260728-1',
  }
  const server = createMcpServer({
    context,
    dispatch: async () => {
      const error = new Error('优先级必须是：0=低，1=中，2=高')
      error.code = 'MCP_ARGUMENT_INVALID'
      error.fieldErrors = { priority: error.message }
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
    name: 'task_manage',
    arguments: { operation: 'update', id: 59, priority: 9, mode: 'preview' },
  })
  assert.equal(result.structuredContent.error.requestId, context.auditRequestId)
  assert.match(result.content[0].text, /MCP_ARGUMENT_INVALID/)
  assert.match(result.content[0].text, /priority=/)
  assert.match(result.content[0].text, /mcp-request-20260728-1/)
})

test('tool filtering separates Query and Action credentials even with the same menu permissions', () => {
  const allowedMenuPaths = new Set(['/products', '/projects', '/tasks'])
  const queryNames = filterToolsForContext({ endpointType: 'query', allowedMenuPaths }).map((tool) => tool.name)
  const actionNames = filterToolsForContext({ endpointType: 'action', allowedMenuPaths }).map((tool) => tool.name)

  assert.equal(queryNames.includes('task_search'), true)
  assert.equal(queryNames.includes('task_manage'), false)
  assert.equal(actionNames.includes('task_manage'), true)
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
  const definition = require('../src/mcp/catalog').getToolDefinition('business_get', 'query')
  assert.doesNotThrow(() => validateToolArguments(definition, { domain: 'project', target_id: 1 }))
  assert.throws(() => validateToolArguments(definition, {}), /缺少参数/)
  assert.throws(
    () => validateToolArguments(definition, { domain: 'project', target_id: 1, sql: 'SELECT 1' }),
    /不支持的参数/
  )
  assert.equal(filterToolsForContext(context).find((tool) => tool.name === 'business_get').inputSchema.additionalProperties, false)
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

test('business attachment search is read-only and exposes governed filters', () => {
  const catalog = require('../src/mcp/catalog')
  const context = { endpointType: 'query', allowedMenuPaths: new Set(['/projects']) }
  const definition = catalog.getToolDefinition('business_attachment_search', 'query')

  assert.equal(filterToolsForContext(context).some((tool) => tool.name === 'business_attachment_search'), true)
  assert.equal(definition.annotations.readOnlyHint, true)
  assert.deepEqual(
    filterToolsForContext(context).find((tool) => tool.name === 'business_attachment_search')
      .inputSchema.properties.attachment_type.enum,
    ['stage_delivery', 'project_contract']
  )
  assert.doesNotThrow(() => validateToolArguments(definition, {
    keyword: '验收', attachment_type: 'stage_delivery', project_id: 12, page: 1, page_size: 20,
  }))
  assert.throws(() => validateToolArguments(definition, { attachment_type: 'avatar' }), /附件类型必须是/)
})

test('business attachment search returns permitted active files as URLs and never inline bytes', async () => {
  const rows = [
    { attachment_type: 'stage_delivery', file_id: 31, file_name: '验收报告.pdf', mime_type: 'application/pdf', file_size: 1024, project_id: 12, product_id: null, business_id: 21, business_name: '完成验收', parent_name: 'A项目' },
    { attachment_type: 'project_contract', file_id: 32, file_name: '项目合同.pdf', mime_type: 'application/pdf', file_size: 6291456, project_id: 12, product_id: null, business_id: 22, business_name: '建设合同', parent_name: 'A项目' },
    { attachment_type: 'product_maintenance_contract', file_id: 33, file_name: '运维合同.pdf', mime_type: 'application/pdf', file_size: 2048, project_id: null, product_id: 7, business_id: 23, business_name: '年度运维合同', parent_name: 'B产品' },
  ]
  const executedSql = []
  const database = {
    prepare(sql) {
      executedSql.push(sql)
      return {
        get: async () => ({ total: rows.length }),
        all: async () => rows,
      }
    },
  }
  const result = await searchBusinessAttachments({}, {
    allowedMenuPaths: new Set(['/projects', '/products']), user: { id: 8 },
  }, database, {
    createDownloadUrl: (uri) => `https://pmis.example.com/api/mcp/files/${encodeURIComponent(uri)}`,
  })

  assert.deepEqual(result.items.map((item) => item.resource_uri), [
    'pmis://projects/12/stage-plan/items/21/files/31',
    'pmis://projects/12/contract/attachments/32',
    'pmis://products/7/maintenance-contracts/23/attachments/33',
  ])
  assert.equal(result.items.every((item) => /^https:/.test(item.download_url)), true)
  assert.doesNotMatch(JSON.stringify(result), /base64|inline_available|blob|buffer/i)
  assert.match(executedSql.join('\n'), /f\.is_current = 1 AND f\.is_void = 0/)
  assert.match(executedSql.join('\n'), /oss_response IS NOT NULL/)
})

test('business attachment search never queries modules outside employee menu permissions', async () => {
  const sql = []
  const database = { prepare(statement) { sql.push(statement); return { get: async () => ({ total: 0 }), all: async () => [] } } }
  await searchBusinessAttachments({}, {
    allowedMenuPaths: new Set(['/products']), user: { id: 8 },
  }, database, { createDownloadUrl: () => 'https://pmis.example.com/file' })

  assert.match(sql.join('\n'), /pms_product_maintenance_contract_attachment/)
  assert.doesNotMatch(sql.join('\n'), /pms_project_contract_attachment|pms_project_plan_delivery_file/)
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

test('global search returns compact summaries and never forwards inline image bodies', async () => {
  const context = {
    allowedMenuPaths: new Set(['/work-orders']),
    user: { id: 8 },
  }
  const result = await dispatchQueryTool('global_search', {}, context, {
    runTool: async () => ({
      items: [{
        id: 7,
        problem_desc: '<p>网络故障</p><img src="data:image/png;base64,AAAA">',
      }],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
  })

  assert.equal(result.results.work_order_search.items[0].problem_desc, '网络故障 〔图片〕')
  assert.doesNotMatch(JSON.stringify(result), /data:image|base64/i)
})

test('successful MCP tool responses keep full data only once', async () => {
  const value = { items: [{ id: 1, name: '任务A' }], total: 1 }
  const result = require('../src/mcp/createServer').asToolResult(value)

  assert.deepEqual(result.structuredContent, value)
  assert.match(result.content[0].text, /结构化结果/)
  assert.doesNotMatch(result.content[0].text, /任务A/)
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
    ['product_create', { name: '产品', owner_id: 8, mode: 'preview' }, ['idempotency_key']],
    ['project_create', { name: '项目', product_id: 1, requirement_id: 2, owner_id: 8, expected_end_date: '2026-08-31', mode: 'preview' }, ['idempotency_key']],
    ['requirement_create', {
      title: '需求', requirement_type: 1, product_id: 1, owner_id: 8,
      submitter_name: '张三', submit_date: '2026-07-28',
      mode: 'preview',
    }, ['idempotency_key']],
    ['task_create', {
      name: '任务', source_type: 1, project_id: 1, task_type: 2, owner_ids: [8],
      expected_end_date: '2026-08-31',
      mode: 'preview',
    }, ['idempotency_key']],
    ['bug_create', {
      title: 'BUG', source_type: 1, project_id: 1, bug_type_id: 2, severity: 2, assignee_id: 8,
      mode: 'preview',
    }, ['idempotency_key']],
    ['work_order_create', {
      product_id: 1, problem_type: 2, problem_desc: '无法登录', follower_id: 8,
      urgency: 1, expected_resolve_date: '2026-07-29', submitter_name: '张三',
      submitter_dept: '技术部', submit_time: '2026-07-28',
      mode: 'preview',
    }, ['idempotency_key']],
    ['stage_create', { project_id: 1, name: '启动', mode: 'preview' }, ['idempotency_key']],
    ['stage_item_create', {
      project_id: 1, stage_id: 2, name: '上线', owner_id: 8, original_due_date: '2026-08-01',
      mode: 'preview',
    }, ['idempotency_key']],
    ['contract_create', {
      project_id: 1, contract_code: 'HT-001', contract_name: '建设合同',
      supplier_id: 3, signed_date: '2026-07-28', contract_amount: 100,
      stages: [{ stage_name: '首付款', planned_amount: 100 }],
      mode: 'preview',
    }, ['idempotency_key']],
    ['payment_create', {
      project_id: 1, stage_id: 2, payment_amount: 100,
      payment_month: '2026-07', handler_id: 8,
      mode: 'preview',
    }, ['idempotency_key']],
    ['contract_attachment_upload', {
      project_id: 1, file_name: '合同.pdf', file_url: 'https://oss.example.com/pmis/contracts/a.pdf',
      mode: 'preview',
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

test('task create schemas default priority and require expected completion time while update keeps sparse editing', () => {
  const { getToolDefinition } = require('../src/mcp/catalog')
  const cases = [
    ['task_create', {
      name: '任务', source_type: 1, project_id: 1, task_type: 2, owner_ids: [8],
      idempotency_key: 'task-create-1',
      mode: 'preview',
    }],
    ['task_create_subtask', {
      parent_id: 1, name: '子任务', task_type: 2, owner_ids: [8],
      idempotency_key: 'task-subtask-1',
      mode: 'preview',
    }],
  ]

  for (const [name, args] of cases) {
    const definition = getToolDefinition(name, 'action')
    assert.throws(
      () => validateToolArguments(definition, args),
      /缺少参数：expected_end_date/,
      name
    )
    assert.doesNotThrow(() => validateToolArguments(definition, {
      ...args,
      expected_end_date: '2026-08-31',
    }), name)
  }

  const updateDefinition = getToolDefinition('task_update', 'action')
  assert.doesNotThrow(() => validateToolArguments(updateDefinition, {
    id: 2,
    name: '任务',
    source_type: 1,
    project_id: 1,
    task_type: 2,
    owner_ids: [8],
    mode: 'preview',
  }))
})

test('action argument validation rejects malformed types, nested values and execute confirmations', () => {
  const { getToolDefinition } = require('../src/mcp/catalog')
  const taskAssign = getToolDefinition('task_assign', 'action')
  const taskCreate = getToolDefinition('task_create', 'action')
  const contractCreate = getToolDefinition('contract_create', 'action')
  const taskDelete = getToolDefinition('task_delete', 'action')

  assert.throws(
    () => validateToolArguments(taskAssign, { ids: '1,2', owner_ids: [8], mode: 'preview' }),
    /ids参数类型不合法/
  )
  assert.throws(
    () => validateToolArguments(getToolDefinition('product_create', 'action'), {
      name: 123,
      owner_id: 8,
      idempotency_key: 'product-1',
      mode: 'preview',
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
      mode: 'preview',
    }),
    /urgency参数类型不合法/
  )
  assert.throws(
    () => validateToolArguments(taskAssign, { ids: [1, { id: 2 }], owner_ids: [8], mode: 'preview' }),
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
      mode: 'preview',
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
      expected_end_date: '2026-08-31',
      idempotency_key: 'task-1',
      mode: 'preview',
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
      mode: 'preview',
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
    /关联类型为项目时，必须提供关联项目/
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
      mode: 'preview',
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

test('status action schemas expose the exact conditional business fields', () => {
  const { getToolDefinition } = require('../src/mcp/catalog')
  const taskProperties = getToolDefinition('task_change_status', 'action').inputSchema.properties
  const bugProperties = getToolDefinition('bug_change_status', 'action').inputSchema.properties
  const stageProperties = getToolDefinition('stage_item_change_status', 'action').inputSchema.properties

  assert.ok(taskProperties.suspend_date)
  assert.equal(taskProperties.pause_date, undefined)
  assert.ok(bugProperties.resolved_date)
  assert.ok(bugProperties.closed_date)
  assert.ok(bugProperties.activation_reason)
  assert.equal(bugProperties.resolve_date, undefined)
  assert.equal(bugProperties.close_date, undefined)
  assert.deepEqual(taskProperties.status.enum, [0, 1, 2, 3])
  assert.deepEqual(bugProperties.status.enum, [0, 1, 2, 3])
  assert.equal(stageProperties.files, undefined)
  assert.match(stageProperties.status.description, /stage_delivery_upload/)
})

test('edit schemas allow clearing optional relationship arrays but keep owners non-empty', () => {
  const { getToolDefinition } = require('../src/mcp/catalog')
  assert.equal(getToolDefinition('project_update', 'action').inputSchema.properties.member_ids.minItems, 0)
  assert.equal(getToolDefinition('stage_item_update', 'action').inputSchema.properties.collaborator_ids.minItems, 0)
  assert.equal(getToolDefinition('task_update', 'action').inputSchema.properties.owner_ids.minItems, 1)
})

test('MCP rate limit counts tool calls per client and employee and exposes retry details', async () => {
  let current = 1000
  const audits = []
  const middleware = createMcpRateLimit('action', {
    limit: 1,
    windowMs: 100,
    now: () => current,
    recordLimit: async (entry) => audits.push(entry),
  })
  const response = () => ({
    statusCode: 200,
    headers: {},
    set(name, value) { this.headers[name] = String(value); return this },
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  })
  const request = (employeeNo = '005829', method = 'tools/call') => ({
    mcpContext: {
      auditRequestId: `request-${employeeNo}`,
      client: { id: 1 },
      user: { id: 8, employeeNo },
      endpointType: 'action',
      ip: '127.0.0.1',
    },
    body: { jsonrpc: '2.0', id: 1, method },
  })
  const protocol = response()
  await middleware(request('005829', 'tools/list'), protocol, () => { protocol.next = true })
  const first = response()
  await middleware(request(), first, () => { first.next = true })
  const second = response()
  await middleware(request(), second, () => { second.next = true })
  const other = response()
  await middleware(request('004825'), other, () => { other.next = true })
  current += 101
  const reset = response()
  await middleware(request(), reset, () => { reset.next = true })

  assert.equal(protocol.next, true)
  assert.equal(first.next, true)
  assert.equal(second.statusCode, 429)
  assert.equal(second.headers['Retry-After'], '1')
  assert.equal(second.body.error.code, -32029)
  assert.equal(second.body.error.data.retryAfterSeconds, 1)
  assert.equal(second.body.error.data.limit, 1)
  assert.equal(second.body.error.data.requestId, 'request-005829')
  assert.equal(other.next, true)
  assert.equal(reset.next, true)
  assert.equal(audits.length, 1)
  assert.equal(audits[0].resultStatus, 'rate_limited')
  assert.equal(audits[0].employeeNo, '005829')
})

test('MCP rate limit counts every tools/call inside a protocol batch', async () => {
  const middleware = createMcpRateLimit('query', {
    limit: 1,
    windowMs: 60_000,
    now: () => 1000,
    recordLimit: async () => {},
  })
  const req = {
    mcpContext: {
      auditRequestId: 'batch-request',
      client: { id: 1 },
      user: { id: 8, employeeNo: '005829' },
      endpointType: 'query',
    },
    body: [
      { jsonrpc: '2.0', id: 1, method: 'tools/call' },
      { jsonrpc: '2.0', id: 2, method: 'tools/call' },
    ],
  }
  const res = {
    headers: {},
    set(name, value) { this.headers[name] = String(value); return this },
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
  await middleware(req, res, () => { res.next = true })
  assert.equal(res.statusCode, 429)
  assert.equal(res.body.error.data.limit, 1)
})
