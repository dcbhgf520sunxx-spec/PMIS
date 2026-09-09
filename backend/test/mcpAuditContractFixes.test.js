const assert = require('node:assert/strict')
const test = require('node:test')
const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js')
const { AjvJsonSchemaValidator } = require('@modelcontextprotocol/sdk/validation/ajv')
const db = require('../src/db')
const { toPostgresSql } = require('../src/dbSql')
const { createMcpServer } = require('../src/mcp/createServer')
const { dispatchMcpTool, validateToolArguments } = require('../src/mcp/dispatcher')
const { getPublicToolDefinition } = require('../src/mcp/catalog')

async function connect(t, context, dispatch = dispatchMcpTool) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createMcpServer({ context, dispatch })
  const client = new Client({ name: 'audit-contract-fixture', version: '1.0.0' })
  t.after(async () => { await client.close(); await server.close() })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  await client.listTools()
  return client
}

function queryContext() {
  return { endpointType: 'query', client: { id: 9001 },
    identityVersion: 'v3',
    user: { id: 8, employeeNo: 'CONTRACT-FIXTURE' },
    allowedMenuPaths: new Set(['/tasks', '/projects']), allowedPermissionCodes: new Set(),
    auditRequestId: 'contract-fixture' }
}

test('basic status distribution passes actual SDK output validation and keeps its Chinese label', async (t) => {
  const original = db.prepare
  let auditedInput
  t.after(() => { db.prepare = original })
  db.prepare = sql => {
    if (/INSERT INTO pms_mcp_audit_log/.test(sql)) return { run: async (...values) => {
      auditedInput = JSON.parse(values[11])
      return { changes: 1 }
    } }
    if (/SELECT status status, COUNT\(\*\)::INTEGER value FROM pms_task/.test(sql)) {
      return { all: async () => [{ status: 1, value: 7 }] }
    }
    throw new Error(`Unexpected isolated query: ${sql}`)
  }
  const client = await connect(t, queryContext())
  const result = await client.callTool({ name: 'business_analyze', arguments: { domain: 'task', metric: 'status_distribution' } })
  assert.equal(result.isError, undefined)
  assert.deepEqual(result.structuredContent.results, [{ status: 1, status_label: '处理中', value: 7 }])
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent)
  assert.equal(auditedInput._identity_version, 'v3')
})

test('decimal amount strings retain exact precision through the actual SDK response', async (t) => {
  const original = db.prepare
  t.after(() => { db.prepare = original })
  db.prepare = sql => {
    if (/INSERT INTO pms_mcp_audit_log/.test(sql)) return { run: async () => ({ changes: 1 }) }
    if (/SUM\(contract_amount\)/.test(sql)) return { all: async () => [{ value: '90071992547409.91' }] }
    throw new Error(`Unexpected isolated query: ${sql}`)
  }
  const client = await connect(t, queryContext())
  const result = await client.callTool({ name: 'business_analyze', arguments: { domain: 'contract', metric: 'amount_sum' } })
  assert.equal(result.isError, undefined)
  assert.equal(result.structuredContent.results[0].value, '90071992547409.91')
  assert.equal(JSON.parse(result.content[0].text).results[0].value, '90071992547409.91')
})

test('statistics schema accepts exact decimal amounts but rejects text amounts and string counts', () => {
  const schema = getPublicToolDefinition('business_analyze', 'query').outputSchema
  const validate = new AjvJsonSchemaValidator().getValidator(schema)
  const result = { domain: 'contract', metric: 'amount_sum', scope: {}, definition: '有效记录金额合计' }
  for (const value of ['0', '100.50', '90071992547409.91', 100.5]) {
    assert.equal(validate({ ...result, results: [{ value }] }).valid, true, String(value))
  }
  for (const value of ['NaN', '', '100元', '1e99', null]) {
    assert.equal(validate({ ...result, results: [{ value }] }).valid, false, String(value))
  }
  assert.equal(validate({ ...result, metric: 'count', results: [{ value: '7' }] }).valid, false)
  assert.equal(validate({ ...result, metric: 'count', results: [{ value: 7 }] }).valid, true)
})

test('ISO datetime cannot bypass real calendar-date validation for work-order submit_time', () => {
  const definition = getPublicToolDefinition('work_order_manage', 'action')
  const base = { mode: 'preview', operation: 'update', id: 1 }
  for (const submit_time of ['2026-02-30T10:00:00+08:00', '2026-02-29T10:00:00Z', '2026-04-31T10:00+08:00']) {
    assert.throws(() => validateToolArguments(definition, { ...base, submit_time }),
      error => error.code === 'MCP_ARGUMENT_INVALID' && Boolean(error.fieldErrors.submit_time), submit_time)
  }
  for (const submit_time of ['2024-02-29', '2024-02-29T10:00:00+08:00', '2026-02-28T10:00Z', '2026-09-09T10:00:00.123Z']) {
    assert.doesNotThrow(() => validateToolArguments(definition, { ...base, submit_time }), submit_time)
  }
})

test('public action enum errors retain Chinese values and conditional status guidance', () => {
  for (const [name, expected] of [['task_flow', /处理中/], ['work_order_flow', /待处理/]]) {
    assert.throws(() => validateToolArguments(getPublicToolDefinition(name, 'action'), {
      mode: 'preview', operation: 'change_status', id: 1, status: 99,
    }), error => {
      assert.equal(error.code, 'MCP_ARGUMENT_INVALID')
      assert.match(error.fieldErrors.status, expected)
      return true
    })
  }
})

test('text-only consumers get the same safe business result as structured-content clients', async (t) => {
  const business = { domain: 'task', data: { id: 1, name: '接口联调', status: 1, status_label: '处理中' } }
  const client = await connect(t, queryContext(), async () => business)
  const result = await client.callTool({ name: 'business_get', arguments: { domain: 'task', target_id: 1 } })
  assert.deepEqual(JSON.parse(result.content[0].text), business)
  assert.deepEqual(result.structuredContent, business)
  assert.equal(result.content.length, 1)
})

test('PostgreSQL NUMERIC result is accepted without changing the database decimal representation',
  { skip: process.env.MCP_ANALYSIS_DB_TEST !== '1' }, async (t) => {
    assert.ok(['localhost', '127.0.0.1', '::1'].includes(db.pool.options.host), 'Only local PostgreSQL is allowed')
    const original = db.prepare
    const connection = await db.pool.connect()
    try {
      await connection.query('BEGIN READ ONLY')
      db.prepare = sql => {
        if (/INSERT INTO pms_mcp_audit_log/.test(sql)) return { run: async () => ({ changes: 1 }) }
        if (/SUM\(contract_amount\)/.test(sql)) return { all: async (...params) => (
          await connection.query(`WITH pms_project_contract AS (
            SELECT 0 AS is_deleted, NUMERIC '100.50' AS contract_amount
          ) ${toPostgresSql(sql)}`, params)).rows }
        throw new Error(`Unexpected isolated query: ${sql}`)
      }
      const client = await connect(t, queryContext())
      const result = await client.callTool({ name: 'business_analyze', arguments: { domain: 'contract', metric: 'amount_sum' } })
      assert.equal(result.structuredContent.results[0].value, '100.50')
      assert.equal(result.isError, undefined)
    } finally {
      db.prepare = original
      await connection.query('ROLLBACK')
      connection.release()
      await db.pool.end()
    }
  })
