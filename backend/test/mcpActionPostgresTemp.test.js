const assert = require('node:assert/strict')
const test = require('node:test')
const { Client } = require('pg')
const db = require('../src/db')
const { dispatchActionTool } = require('../src/mcp/actionTools')

// Explicitly opt in on the registered local PostgreSQL only. Every write below
// targets connection-local TEMP tables; physical connection close removes them.
test('local PostgreSQL action transaction, rollback and connection isolation', {
  skip: process.env.MCP_ACTION_PG_TEMP_TEST !== '1',
}, async (t) => {
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(db.pool.options.host), 'only the local database is allowed')
  assert.equal(Number(db.pool.options.port), 5433, 'only the registered SIDM PostgreSQL port is allowed')
  const client = new Client(db.pool.options)
  await client.connect()
  try {
    await client.query(`
      CREATE TEMP TABLE pms_product (id BIGINT PRIMARY KEY, name TEXT, description TEXT,
        owner_id BIGINT, status INTEGER, is_deleted INTEGER DEFAULT 0, updater_id BIGINT, updated_at TIMESTAMP);
      CREATE TEMP TABLE pms_user (id BIGINT PRIMARY KEY, real_name TEXT, status INTEGER, is_deleted INTEGER DEFAULT 0);
      CREATE TEMP TABLE pms_mcp_action_ticket (id UUID PRIMARY KEY, client_id BIGINT, user_id BIGINT,
        employee_no TEXT, tool_name TEXT, arguments_hash TEXT, preview JSONB, idempotency_key TEXT,
        risk_level TEXT, status TEXT, expires_at TIMESTAMPTZ, executed_at TIMESTAMPTZ);
      CREATE TEMP TABLE pms_op_log (id BIGINT DEFAULT 1, user_id BIGINT, action TEXT, module TEXT,
        target_id BIGINT, field_name TEXT CHECK (field_name <> 'name'), old_value TEXT, new_value TEXT,
        ip TEXT, target_name TEXT, operation_id UUID);
      INSERT INTO pg_temp.pms_product (id, name, description, owner_id, status) VALUES (9, '原名称', '原说明', 8, 1);
      INSERT INTO pg_temp.pms_user (id, real_name, status) VALUES (8, '临时测试人员', 1);
    `)
    const context = {
      endpointType: 'action', client: { id: 3 }, user: { id: 8, employeeNo: 'TEMP-FIXTURE', realName: '临时测试人员' },
      allowedMenuPaths: new Set(['/products']), allowedPermissionCodes: new Set(),
    }
    t.mock.method(db.pool, 'query', (sql, values) => client.query(sql, values))
    t.mock.method(db.pool, 'connect', async () => ({ query: (sql, values) => client.query(sql, values), release() {} }))

    await t.test('controller HTTP error rolls back business/history but commits a failed single-use ticket', async (st) => {
      st.mock.method(console, 'error', () => {})
      const preview = await dispatchActionTool('product_update', { id: 9, name: '不得保留的新名称', mode: 'preview' }, context)
      await assert.rejects(dispatchActionTool('product_update', preview.executeArguments, context),
        (error) => error.code === 'MCP_BUSINESS_ERROR')
      assert.equal((await client.query('SELECT name FROM pg_temp.pms_product WHERE id=9')).rows[0].name, '原名称')
      assert.equal((await client.query('SELECT status FROM pg_temp.pms_mcp_action_ticket WHERE id=$1', [preview.confirmationId])).rows[0].status, 'failed')
      assert.equal((await client.query('SELECT count(*)::INTEGER count FROM pg_temp.pms_op_log')).rows[0].count, 0)
      await assert.rejects(dispatchActionTool('product_update', preview.executeArguments, context),
        (error) => error.code === 'MCP_CONFIRMATION_ALREADY_USED')
    })

    await t.test('sparse confirmation preserves a later unrelated edit with PostgreSQL BIGINT values', async () => {
      const preview = await dispatchActionTool('product_update', { id: 9, description: '确认的新说明', mode: 'preview' }, context)
      await client.query('UPDATE pg_temp.pms_product SET name=$1 WHERE id=9', ['别人改的名称'])
      const result = await dispatchActionTool('product_update', preview.executeArguments, context)
      assert.equal(result.executed, true)
      const row = (await client.query('SELECT name,description FROM pg_temp.pms_product WHERE id=9')).rows[0]
      assert.deepEqual(row, { name: '别人改的名称', description: '确认的新说明' })
    })

    await t.test('expired confirmation state is committed while execution is rejected', async () => {
      const preview = await dispatchActionTool('product_update', { id: 9, description: '过期后不得执行', mode: 'preview' }, context)
      await client.query("UPDATE pg_temp.pms_mcp_action_ticket SET expires_at='2000-01-01' WHERE id=$1", [preview.confirmationId])
      await assert.rejects(dispatchActionTool('product_update', preview.executeArguments, context),
        (error) => error.code === 'MCP_CONFIRMATION_EXPIRED')
      assert.equal((await client.query('SELECT status FROM pg_temp.pms_mcp_action_ticket WHERE id=$1', [preview.confirmationId])).rows[0].status, 'expired')
      assert.equal((await client.query('SELECT description FROM pg_temp.pms_product WHERE id=9')).rows[0].description, '确认的新说明')
    })

    await t.test('nested controller transaction error rolls back to a savepoint without losing outer work', async () => {
      await db.withTransaction(async () => {
        await db.prepare('UPDATE pg_temp.pms_product SET description=? WHERE id=?').run('外层变更', 9)
        await assert.rejects(db.transaction(async () => {
          await db.prepare('UPDATE pg_temp.pms_product SET description=? WHERE id=?').run('应回滚内层', 9)
          await db.exec('SELECT 1 / 0')
        }), /division by zero/)
        assert.equal((await db.prepare('SELECT description FROM pg_temp.pms_product WHERE id=?').get(9)).description, '外层变更')
      })
      assert.equal((await client.query('SELECT description FROM pg_temp.pms_product WHERE id=9')).rows[0].description, '外层变更')
    })

    await t.test('two physical PostgreSQL connections remain isolated across interleaved awaits', async (st) => {
      const other = new Client(db.pool.options)
      await other.connect()
      try {
        await client.query("CREATE TEMP TABLE pms_mcp_context_fixture (marker TEXT); INSERT INTO pg_temp.pms_mcp_context_fixture VALUES ('first')")
        await other.query("CREATE TEMP TABLE pms_mcp_context_fixture (marker TEXT); INSERT INTO pg_temp.pms_mcp_context_fixture VALUES ('second')")
        const connections = [client, other]
        st.mock.method(db.pool, 'connect', async () => {
          const connection = connections.shift()
          assert.ok(connection, 'unexpected extra physical connection')
          return { query: (sql, values) => connection.query(sql, values), release() {} }
        })
        let firstReady
        const started = new Promise((resolve) => { firstReady = resolve })
        let secondReady
        const interleaved = new Promise((resolve) => { secondReady = resolve })
        const first = db.withTransaction(async () => {
          const before = await db.prepare('SELECT marker FROM pg_temp.pms_mcp_context_fixture').get()
          firstReady()
          await interleaved
          return [before.marker, (await db.prepare('SELECT marker FROM pg_temp.pms_mcp_context_fixture').get()).marker]
        })
        await started
        const second = db.withTransaction(async () => {
          const row = await db.prepare('SELECT marker FROM pg_temp.pms_mcp_context_fixture').get()
          secondReady()
          return row.marker
        })
        assert.deepEqual(await Promise.all([first, second]), [['first', 'first'], 'second'])
      } finally { await other.end() }
    })
  } finally { await client.end() }
})
