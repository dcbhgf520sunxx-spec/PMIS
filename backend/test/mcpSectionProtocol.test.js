const assert = require('node:assert/strict')
const test = require('node:test')
const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js')
const { AjvJsonSchemaValidator } = require('@modelcontextprotocol/sdk/validation/ajv')
const db = require('../src/db')
const { createMcpServer } = require('../src/mcp/createServer')
const { dispatchMcpTool } = require('../src/mcp/dispatcher')

const sections = [
  'period_flows', 'current_stock', 'plan_outlook', 'comparison', 'trend', 'groupings',
  'quality_and_delivery', 'financials', 'flow_candidates', 'risk_candidates', 'report_people',
]
const baseArgs = {
  analysis_period: { preset: 'custom', start_date: '2026-09-01', end_date: '2026-09-07' },
  business_types: ['task'],
  metrics: ['created'],
}
const validator = new AjvJsonSchemaValidator()

function context(menuPaths = ['/tasks']) {
  return {
    endpointType: 'query', user: { id: 8, employeeNo: 'SECTION-PROTOCOL' },
    client: { id: 9002 }, auditRequestId: 'section-protocol-fixture',
    allowedMenuPaths: new Set(menuPaths), allowedPermissionCodes: new Set(),
  }
}

async function connectProtocol(t, ctx = context()) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createMcpServer({ context: ctx, dispatch: dispatchMcpTool })
  const client = new Client({ name: 'section-protocol-test', version: '1.0.0' })
  t.after(async () => { await client.close(); await server.close() })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  const { tools } = await client.listTools()
  const outputValidators = new Map(tools.map(tool => [tool.name, validator.getValidator(tool.outputSchema)]))
  return {
    tools,
    async call(name, args) {
      const result = await client.callTool({ name, arguments: args })
      if (!result.isError) {
        const validation = outputValidators.get(name)(result.structuredContent)
        assert.equal(validation.valid, true, validation.errorMessage)
      }
      return result
    },
  }
}

function assertError(result, code) {
  assert.equal(result.isError, true)
  assert.equal(result.structuredContent.error.code, code)
  assert.equal(result.structuredContent.error.requestId, 'section-protocol-fixture')
}

function periodRow(id) {
  return {
    business_type: 'task', id, name: `协议事项${id}`, status: 1, priority: 1,
    product_id: null, project_id: null, requirement_id: null, parent_task_id: null,
    owner_id: 8, owner_name: '协议人员', owner_ids: [8], business_role_ids: [8],
    person_ids: [8], creator_id: 8, updater_id: 8,
    plan_date: '2026-09-08', actual_date: null, pause_date: null,
    created_at: `2026-09-0${id} 09:00:00+08`, is_completed: false, is_paused: false,
    is_overdue: 0, parent_project_paused: false, required_delivery: false, delivery_count: 0,
  }
}

function installFixture(t) {
  const state = {
    rows: [periodRow(1), periodRow(2), periodRow(3)],
    calls: [], audits: 0, fail: new Set(),
  }
  const originalPrepare = db.prepare
  t.after(() => { db.prepare = originalPrepare })
  db.prepare = (sql) => {
    if (/INSERT INTO pms_mcp_audit_log/.test(sql)) {
      return { run: async () => { state.audits += 1; return { changes: 1 } } }
    }
    const marker = /period_analysis:([a-z_:]+)/.exec(sql)?.[1]
    if (!marker) throw new Error('协议测试遇到未隔离的数据库调用')
    const read = async (...ids) => {
      state.calls.push(marker)
      if (state.fail.has(marker)) throw new Error('受控数据来源故障')
      if (marker === 'records:task') return structuredClone(state.rows)
      if (marker === 'logs') return []
      if (marker === 'people' || marker === 'report_people') {
        const requested = new Set(ids.flat().map(Number))
        return [8].filter(id => requested.has(id))
          .map(id => ({ id, name: '协议人员', status: 1, is_deleted: 0 }))
      }
      if (marker === 'financials') return { contract_count: 0, contract_amount: 0 }
      throw new Error(`协议测试未覆盖数据来源：${marker}`)
    }
    return { all: read, get: read }
  }
  return state
}

test('real SDK protocol preserves selective period-analysis semantics end to end', async (t) => {
  const state = installFixture(t)
  const protocol = await connectProtocol(t)

  await t.test('discovery advertises the exact supported sections', () => {
    const tool = protocol.tools.find(item => item.name === 'business_period_analysis')
    assert.ok(tool)
    assert.deepEqual(tool.inputSchema.properties.sections.items.enum, sections)
    assert.equal(tool.inputSchema.properties.sections.uniqueItems, true)
  })

  await t.test('selected output contains only requested blocks while omission keeps the legacy full result', async () => {
    state.calls.length = 0
    const selected = await protocol.call('business_period_analysis', {
      ...baseArgs, sections: ['period_flows'],
    })
    assert.equal(selected.isError, undefined)
    assert.deepEqual(Object.keys(selected.structuredContent).sort(),
      ['resolved_periods', 'data_cutoff', 'coverage', 'period_flows'].sort())
    assert.equal(selected.structuredContent.period_flows.total.created, 3)
    assert.deepEqual(selected.structuredContent.coverage.requested_sections, ['period_flows'])
    assert.deepEqual(selected.structuredContent.coverage.section_completeness, { period_flows: true })
    assert.equal(selected.structuredContent.coverage.statistics_complete, true)
    assert.deepEqual(state.calls, ['records:task'])

    const legacy = await protocol.call('business_period_analysis', baseArgs)
    for (const section of sections) assert.ok(Object.hasOwn(legacy.structuredContent, section), section)
    assert.equal(legacy.structuredContent.coverage.requested_sections, undefined)
    assert.equal(legacy.structuredContent.coverage.section_completeness, undefined)
  })

  await t.test('duplicate and unknown sections remain MCP argument errors across the SDK boundary', async () => {
    for (const invalid of [['current_stock', 'current_stock'], ['not_a_section']]) {
      const result = await protocol.call('business_period_analysis', { ...baseArgs, sections: invalid })
      assertError(result, 'MCP_ARGUMENT_INVALID')
    }
  })

  await t.test('unauthorized direct calls are denied before any business read', async (child) => {
    const deniedProtocol = await connectProtocol(child, context([]))
    assert.equal(deniedProtocol.tools.some(tool => tool.name === 'business_period_analysis'), false)
    const before = state.calls.length
    const result = await deniedProtocol.call('business_period_analysis', {
      ...baseArgs, sections: ['period_flows'],
    })
    assert.equal(result.isError, true)
    assert.equal(result.structuredContent.error.code, 'MCP_PERMISSION_DENIED')
    assert.equal(state.calls.length, before)
  })

  await t.test('detail pagination may carry or change sections without changing the dataset or losing rows', async () => {
    const ids = []
    let token
    for (let page = 1; page <= 3; page += 1) {
      const result = await protocol.call('business_period_analysis', {
        ...baseArgs,
        sections: page === 2 ? ['financials'] : ['current_stock'],
        detail_query: {
          source: 'stock', metric: 'total', page, page_size: 1,
          ...(token ? { dataset_token: token } : {}),
        },
      })
      assert.deepEqual(Object.keys(result.structuredContent).sort(),
        ['resolved_periods', 'data_cutoff', 'coverage', 'details'].sort())
      token ||= result.structuredContent.details.datasetToken
      assert.equal(result.structuredContent.details.datasetToken, token)
      assert.equal(result.structuredContent.details.total, 3)
      ids.push(...result.structuredContent.details.items.map(item => item.target_id))
    }
    assert.deepEqual(ids, [1, 2, 3])
  })

  await t.test('a requested historical dependency failure cannot be reported as complete', async () => {
    state.fail.add('logs')
    const result = await protocol.call('business_period_analysis', {
      ...baseArgs, sections: ['period_flows'], metrics: ['completed'],
    })
    state.fail.delete('logs')
    assert.equal(result.isError, undefined)
    assert.equal(result.structuredContent.coverage.component_completeness.event_history, false)
    assert.deepEqual(result.structuredContent.coverage.section_completeness, { period_flows: false })
    assert.equal(result.structuredContent.coverage.statistics_complete, false)
  })

  assert.ok(state.audits > 0)
})
