const assert = require('node:assert/strict')
const test = require('node:test')

const servicePath = '../src/services/mcpCredentialService'

function createDb(rows = []) {
  const calls = []
  return {
    calls,
    prepare(sql) {
      return {
        async get(...params) {
          calls.push({ type: 'get', sql, params })
          if (sql.includes('FROM pms_mcp_client')) return rows.shift()
          return null
        },
        async run(...params) {
          calls.push({ type: 'run', sql, params })
          return { lastInsertRowid: 9, changes: 1 }
        }
      }
    }
  }
}

test('hashToken returns a stable SHA-256 digest without preserving plaintext', () => {
  const { hashToken } = require(servicePath)
  const digest = hashToken('pmis_q_plaintext-secret')

  assert.equal(digest, 'bb006a4b9e15576813bee4a137f8539c12221a2db2493b1449bf91b9aadc4f82')
  assert.equal(digest.includes('plaintext-secret'), false)
})

test('authenticateClient accepts only an active unexpired client for the requested endpoint', async () => {
  const { createMcpCredentialService } = require(servicePath)
  const db = createDb([{
    id: 7,
    name: '公司智能体查询',
    endpoint_type: 'query',
    status: 1,
    is_deleted: 0,
    expires_at: '2026-07-28T00:00:00.000Z'
  }])
  const service = createMcpCredentialService({
    db,
    now: () => new Date('2026-07-27T00:00:00.000Z')
  })

  const client = await service.authenticateClient('pmis_q_plaintext-secret', 'query')

  assert.equal(client.id, 7)
  assert.equal(db.calls.at(-1).type, 'run')
  assert.match(db.calls.at(-1).sql, /last_used_at/)
})

test('authenticateClient rejects endpoint mismatch, disabled and expired credentials', async () => {
  const { createMcpCredentialService } = require(servicePath)
  const now = () => new Date('2026-07-27T00:00:00.000Z')

  for (const [row, expected] of [
    [{ id: 1, endpoint_type: 'action', status: 1, is_deleted: 0 }, /入口不匹配/],
    [{ id: 2, endpoint_type: 'query', status: 0, is_deleted: 0 }, /已停用/],
    [{ id: 3, endpoint_type: 'query', status: 1, is_deleted: 0, expires_at: '2026-07-26T23:59:59.000Z' }, /已过期/],
  ]) {
    const service = createMcpCredentialService({ db: createDb([row]), now })
    await assert.rejects(service.authenticateClient('token', 'query'), expected)
  }
})

test('issueClient returns plaintext once and stores only its hash', async () => {
  const { createMcpCredentialService } = require(servicePath)
  const db = createDb()
  const service = createMcpCredentialService({
    db,
    randomBytes: () => Buffer.from('01234567890123456789012345678901'),
    now: () => new Date('2026-07-27T00:00:00.000Z')
  })

  const issued = await service.issueClient({
    name: '公司智能体操作',
    endpointType: 'action',
    createdBy: 1
  })

  assert.equal(issued.id, 9)
  assert.match(issued.token, /^pmis_a_/)
  const insert = db.calls.find((call) => call.type === 'run')
  assert.ok(insert)
  assert.equal(insert.params.includes(issued.token), false)
  assert.equal(insert.params.some((value) => value === issued.token.slice(0, 12)), true)
  assert.equal(insert.params.some((value) => /^[a-f0-9]{64}$/.test(String(value))), true)
})
