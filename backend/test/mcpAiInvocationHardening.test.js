const assert = require('node:assert/strict')
const test = require('node:test')

const { getToolDefinition, publicToolCatalog } = require('../src/mcp/catalog')
const { validateToolArguments } = require('../src/mcp/dispatcher')
const {
  decorateQueryResult,
  normalizeSearchResult,
  searchBusinessOptions,
} = require('../src/mcp/queryTools')
const {
  loadActionTargetSnapshot,
  validateStatusAction,
} = require('../src/mcp/actionTools')

test('query text and time filters reject non-text values', () => {
  const cases = [
    ['product_search', { name: 123 }],
    ['global_search', { keyword: true }],
    ['work_order_search', { submit_time_from: 99 }],
  ]
  for (const [name, args] of cases) {
    assert.throws(
      () => validateToolArguments(getToolDefinition(name, 'query'), args),
      (error) => error.code === 'MCP_ARGUMENT_INVALID',
      name
    )
  }
  assert.doesNotThrow(() => validateToolArguments(
    getToolDefinition('work_order_search', 'query'),
    { submit_time_from: '2026-07-01T08:30:00+08:00' }
  ))
})

test('payment stage metadata points to contract payment stages and product selection requires active products', () => {
  for (const [name, endpoint] of [['payment_search', 'query'], ['payment_create', 'action']]) {
    const description = getToolDefinition(name, endpoint).inputSchema.properties.stage_id.description
    assert.match(description, /合同付款阶段/)
    assert.match(description, /business_get\(domain=contract/)
    assert.doesNotMatch(description, /项目阶段/)
  }
  for (const name of ['project_create', 'requirement_create', 'work_order_create']) {
    assert.match(
      getToolDefinition(name, 'action').inputSchema.properties.product_id.description,
      /product_search\(status=1\)/
    )
  }
})

test('user options include a unique readable label without exposing employee credentials', async () => {
  const database = {
    prepare(_sql) {
      return {
        get: async () => ({ total: 2 }),
        all: async () => [
          { id: 8, name: '张三', display_name: '张三（用户ID 8）' },
          { id: 19, name: '张三', display_name: '张三（用户ID 19）' },
        ],
      }
    },
  }
  const result = await searchBusinessOptions({ option_type: 'user' }, database)
  assert.deepEqual(result.items, [
    { id: 8, name: '张三', displayName: '张三（用户ID 8）' },
    { id: 19, name: '张三', displayName: '张三（用户ID 19）' },
  ])
  assert.equal(result.items[0].employeeNo, undefined)
  assert.equal(result.items[0].phone, undefined)
})

test('all search results use the same items pagination envelope', () => {
  assert.deepEqual(normalizeSearchResult({
    list: [{ id: 1 }],
    total: 1,
    page: 1,
    pageSize: 20,
    viewCounts: { mine: 1 },
  }), {
    items: [{ id: 1 }],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    hasNextPage: false,
    viewCounts: { mine: 1 },
  })
  assert.deepEqual(normalizeSearchResult({
    items: [{ id: 2 }],
    total: 1,
    page: 2,
    pageSize: 10,
  }), {
    items: [{ id: 2 }],
    total: 1,
    page: 2,
    pageSize: 10,
    totalPages: 1,
    hasNextPage: false,
  })
})

test('public output schemas describe their stable top-level response fields', () => {
  for (const tool of publicToolCatalog) {
    assert.ok(
      Object.keys(tool.outputSchema?.properties || {}).length > 0 || Array.isArray(tool.outputSchema?.oneOf),
      `${tool.name}仍是无结构输出`
    )
  }
  assert.deepEqual(
    Object.keys(getToolDefinition('task_search', 'query').outputSchema.properties),
    ['items', 'total', 'page', 'pageSize', 'totalPages', 'hasNextPage', 'viewCounts']
  )
})

test('detail results publish currently allowed next statuses with labels', () => {
  const result = decorateQueryResult('task_get', {
    id: 59,
    status: 0,
  })
  assert.deepEqual(result.allowed_statuses, [
    { value: 1, label: '处理中' },
    { value: 3, label: '已暂停' },
  ])
})

test('invalid status transitions report current and allowed target statuses', async () => {
  const database = {
    prepare() {
      return { get: async () => ({ status: 2, previous_status: 1, parent_task_id: null }) }
    },
  }
  await assert.rejects(
    () => validateStatusAction('task_change_status', { id: 59, status: 0 }, database),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION'
      && /当前状态：已完成\(2\)/.test(error.message)
      && /允许变更为：已暂停\(3\)/.test(error.message)
  )
})

test('reorder metadata requires a moved record and explains the complete-list rule', () => {
  for (const name of ['stage_reorder', 'stage_item_reorder']) {
    const schema = getToolDefinition(name, 'action').inputSchema
    assert.ok(schema.required.includes('moved_id'))
    assert.match(schema.properties.ids.description, /完整有序列表/)
  }
})

test('reorder preview validates full membership and presents before/after names', async () => {
  const rows = [
    { id: 11, name: '立项', sort_order: 1 },
    { id: 12, name: '实施', sort_order: 2 },
  ]
  const database = {
    prepare(sql) {
      if (/FROM pms_project_plan_stage s/.test(sql)) return { all: async () => rows }
      return { get: async () => ({ id: 7, name: '项目A' }) }
    },
  }
  const target = await loadActionTargetSnapshot('stage_reorder', {
    project_id: 7,
    ids: [12, 11],
    moved_id: 12,
  }, database)
  assert.deepEqual(target.current.order.map((item) => item.name), ['立项', '实施'])
  assert.deepEqual(target.proposed.order.map((item) => item.name), ['实施', '立项'])
  await assert.rejects(
    () => loadActionTargetSnapshot('stage_reorder', {
      project_id: 7,
      ids: [12],
      moved_id: 12,
    }, database),
    (error) => error.code === 'MCP_BUSINESS_VALIDATION'
      && /必须包含当前全部/.test(error.message)
  )
})
