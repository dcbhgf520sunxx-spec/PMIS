const assert = require('node:assert/strict')
const test = require('node:test')
const crypto = require('node:crypto')
const { Pool, Client } = require('pg')
const db = require('../src/db')
const contract = require('../src/controllers/projectContractController')
const taskController = require('../src/controllers/taskController')
const stageController = require('../src/controllers/projectStagePlanController')
const { invokeController } = require('../src/mcp/controllerAdapter')
const { uploadBusinessAttachment } = require('../src/services/businessAttachmentService')
const { dispatchActionTool } = require('../src/mcp/actionTools')

const context = { client: { id: 3 }, user: { id: 8, employeeNo: 'CONCURRENCY-FIXTURE', realName: '隔离测试' },
  allowedMenuPaths: new Set(['/products', '/projects', '/tasks', '/bugs']), allowedPermissionCodes: new Set() }
const pause = () => new Promise((resolve) => setTimeout(resolve, 75))

test('isolated PostgreSQL resource concurrency invariants', { skip: process.env.MCP_ACTION_CONCURRENCY_TEST !== '1' }, async (t) => {
  t.after(() => db.pool.end())
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(db.pool.options.host))
  assert.equal(Number(db.pool.options.port), 5433)
  const schema = `mcp_action_test_${crypto.randomBytes(10).toString('hex')}`
  const admin = new Client(db.pool.options)
  await admin.connect()
  let isolated, blocker
  try {
    await admin.query(`CREATE SCHEMA ${schema}`)
    isolated = new Pool({ ...db.pool.options, password: db.pool.options.password,
      application_name: schema, options: `-c search_path=${schema},pg_catalog -c timezone=Asia/Shanghai -c lock_timeout=5000`, max: 8 })
    blocker = await isolated.connect()
    t.mock.method(db.pool, 'query', (sql, values) => isolated.query(sql, values))
    t.mock.method(db.pool, 'connect', () => isolated.connect())
    await isolated.query(`
      CREATE TABLE pms_project (id BIGINT PRIMARY KEY, name TEXT, owner_id BIGINT, is_deleted INTEGER DEFAULT 0);
      CREATE TABLE pms_user (id BIGINT PRIMARY KEY, real_name TEXT, status INTEGER DEFAULT 1, is_deleted INTEGER DEFAULT 0);
      CREATE TABLE pms_archive_type (id BIGINT PRIMARY KEY, name TEXT, status INTEGER DEFAULT 1, is_deleted INTEGER DEFAULT 0);
      CREATE TABLE pms_archive (id BIGINT PRIMARY KEY, archive_type_id BIGINT, name TEXT, code TEXT, status INTEGER DEFAULT 1, is_deleted INTEGER DEFAULT 0);
      CREATE TABLE pms_project_contract (id BIGINT PRIMARY KEY, project_id BIGINT, contract_code TEXT, contract_name TEXT,
        supplier_id BIGINT, signed_date DATE, contract_amount NUMERIC, remark TEXT, is_deleted INTEGER DEFAULT 0,
        creator_id BIGINT, updater_id BIGINT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE pms_project_payment_stage (id BIGINT PRIMARY KEY, contract_id BIGINT, stage_name TEXT, planned_amount NUMERIC,
        sort_order INTEGER, is_deleted INTEGER DEFAULT 0, creator_id BIGINT, updater_id BIGINT, updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE pms_project_payment_record (id BIGSERIAL PRIMARY KEY, stage_id BIGINT, payment_amount NUMERIC, payment_month TEXT,
        handler_id BIGINT, remark TEXT, creator_id BIGINT, updater_id BIGINT, is_deleted INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE pms_op_log (id BIGSERIAL PRIMARY KEY, user_id BIGINT, action TEXT, module TEXT, target_id BIGINT,
        field_name TEXT, old_value TEXT, new_value TEXT, ip TEXT, target_name TEXT, operation_id UUID);
      CREATE TABLE pms_task (id BIGINT PRIMARY KEY, name TEXT, description TEXT, status INTEGER DEFAULT 0, priority INTEGER DEFAULT 1,
        source_type INTEGER, project_id BIGINT, requirement_id BIGINT, updater_id BIGINT, updated_at TIMESTAMP DEFAULT NOW(), is_deleted INTEGER DEFAULT 0);
      CREATE TABLE pms_task_owner (task_id BIGINT, user_id BIGINT, sort_order INTEGER);
      CREATE TABLE pms_bug (id BIGINT PRIMARY KEY, title TEXT, assignee_id BIGINT, status INTEGER DEFAULT 0, source_type INTEGER,
        project_id BIGINT, requirement_id BIGINT, updater_id BIGINT, updated_at TIMESTAMP DEFAULT NOW(), is_deleted INTEGER DEFAULT 0);
      CREATE TABLE pms_project_plan_stage (id BIGINT PRIMARY KEY, project_id BIGINT, name TEXT, sort_order INTEGER,
        updater_id BIGINT, updated_at TIMESTAMP DEFAULT NOW(), is_deleted INTEGER DEFAULT 0);
      CREATE TABLE pms_project_plan_item (id BIGINT PRIMARY KEY, stage_id BIGINT, name TEXT, owner_id BIGINT, sort_order INTEGER,
        updater_id BIGINT, updated_at TIMESTAMP DEFAULT NOW(), is_deleted INTEGER DEFAULT 0);
      CREATE TABLE pms_business_attachment (id BIGSERIAL PRIMARY KEY, business_type TEXT, business_id BIGINT, original_name TEXT,
        mime_type TEXT, file_size INTEGER, storage_key TEXT, oss_response JSONB, sort_order INTEGER,
        creator_id BIGINT, updater_id BIGINT, is_deleted INTEGER DEFAULT 0);
      CREATE TABLE pms_mcp_action_ticket (id UUID PRIMARY KEY, client_id BIGINT, user_id BIGINT, employee_no TEXT, tool_name TEXT,
        arguments_hash TEXT, preview JSONB, idempotency_key TEXT, risk_level TEXT, status TEXT, expires_at TIMESTAMPTZ, executed_at TIMESTAMPTZ);
      INSERT INTO pms_project VALUES (1, '临时项目', 8, 0);
      INSERT INTO pms_user(id,real_name) VALUES(8,'临时甲'),(9,'临时乙');
      INSERT INTO pms_archive_type(id,name) VALUES(1,'供应商');
      INSERT INTO pms_archive(id,archive_type_id,name) VALUES(1,1,'临时供应商');
      INSERT INTO pms_project_contract(id,project_id,contract_amount,supplier_id,contract_code,contract_name,signed_date) VALUES (2,1,100,1,'TEST','临时合同','2026-01-01');
      INSERT INTO pms_project_payment_stage(id,contract_id,stage_name,planned_amount) VALUES (3,2,'阶段',100);
      INSERT INTO pms_task(id,name) VALUES (4,'临时任务');
      INSERT INTO pms_task_owner VALUES(4,8,0);
      INSERT INTO pms_bug(id,title,assignee_id) VALUES(6,'临时BUG甲',8),(7,'临时BUG乙',8);
      INSERT INTO pms_project_plan_stage(id,project_id,name,sort_order) VALUES(10,1,'临时计划阶段',0);
      INSERT INTO pms_project_plan_item(id,stage_id,name,owner_id,sort_order) VALUES(11,10,'临时事项甲',8,0),(12,10,'临时事项乙',8,1);
    `)

    await t.test('two HTTP payments serialize on their shared stage and cannot exceed its amount', async () => {
      await blocker.query('BEGIN')
      await blocker.query('SELECT id FROM pms_project_payment_stage WHERE id=3 FOR UPDATE')
      const input = { params: { id: 1, stageId: 3 }, body: { payment_amount: 60, payment_month: '2026-01', handler_id: 8 } }
      let settled = 0
      const calls = [1, 2].map(() => invokeController(contract.createPayment, context, input).then((result) => { settled++; return result }))
      await pause()
      const settledBeforeRelease = settled
      await blocker.query('COMMIT')
      const results = await Promise.all(calls)
      assert.equal(settledBeforeRelease, 0, 'payment must wait for the shared stage lock before reading its balance')
      assert.equal(results.filter((result) => result.code === 0).length, 1)
      assert.equal(Number((await isolated.query('SELECT SUM(payment_amount) amount FROM pms_project_payment_record WHERE is_deleted=0')).rows[0].amount), 60)
    })

    await t.test('business attachments share the parent lock and never exceed ten', async () => {
      await isolated.query("INSERT INTO pms_business_attachment(business_type,business_id) SELECT 'task',4 FROM generate_series(1,9)")
      await blocker.query('BEGIN')
      await blocker.query('SELECT id FROM pms_task WHERE id=4 FOR UPDATE')
      let externalUploads = 0
      const dependencies = { uploadAttachmentToOss: async () => { externalUploads++; return { storageName: 'fixture', ossResponse: {} } } }
      const calls = [1, 2].map(() => uploadBusinessAttachment('task', 4,
        { originalname: 'fixture.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.7') }, 8, dependencies))
      // Attach rejection handlers before releasing the lock.
      const finished = Promise.allSettled(calls)
      await pause()
      const uploadsBeforeRelease = externalUploads
      await blocker.query('COMMIT')
      const results = await finished
      assert.equal(uploadsBeforeRelease, 0)
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
      assert.equal(Number((await isolated.query('SELECT COUNT(*) count FROM pms_business_attachment WHERE is_deleted=0')).rows[0].count), 10)
      assert.equal(externalUploads, 1)
    })

    await t.test('contract stage reduction rechecks payments committed while it waited', async () => {
      await blocker.query('BEGIN')
      await blocker.query('SELECT id FROM pms_project_payment_stage WHERE id=3 FOR UPDATE')
      await blocker.query("INSERT INTO pms_project_payment_record(stage_id,payment_amount,payment_month,handler_id) VALUES(3,30,'2026-01',8)")
      const finished = invokeController(contract.update, context, { params: { id: 1 }, body: {
        contract_code: 'TEST', contract_name: '临时合同', supplier_id: 1, signed_date: '2026-01-01', contract_amount: 70,
        stages: [{ id: 3, stage_name: '阶段', planned_amount: 70 }],
      } })
      await pause()
      await blocker.query('COMMIT')
      const result = await finished
      assert.notEqual(result.code, 0)
      assert.match(JSON.stringify(result.fieldErrors), /计划金额不能小于已付金额/)
      assert.equal(Number((await isolated.query('SELECT planned_amount FROM pms_project_payment_stage WHERE id=3')).rows[0].planned_amount), 100)
    })

    await t.test('concurrent corrections of different payments cannot jointly exceed the stage', async () => {
      const rows = (await isolated.query('SELECT id,payment_amount FROM pms_project_payment_record WHERE is_deleted=0 ORDER BY id')).rows
      assert.equal(rows.length, 2)
      await blocker.query('BEGIN')
      await blocker.query('SELECT id FROM pms_project_payment_stage WHERE id=3 FOR UPDATE')
      const calls = rows.map((row) => invokeController(contract.updatePayment, context, {
        params: { id: 1, paymentId: row.id }, body: { payment_amount: Number(row.payment_amount) + 10, payment_month: '2026-01', handler_id: 8 },
      }))
      await pause()
      await blocker.query('COMMIT')
      const results = await Promise.all(calls)
      assert.equal(results.filter((result) => result.code === 0).length, 1)
      assert.equal(Number((await isolated.query('SELECT SUM(payment_amount) amount FROM pms_project_payment_record WHERE is_deleted=0')).rows[0].amount), 100)
    })

    await t.test('contract stage removal rechecks a payment committed while waiting', async () => {
      await isolated.query("INSERT INTO pms_project_payment_stage(id,contract_id,stage_name,planned_amount) VALUES(5,2,'待移除阶段',10)")
      await isolated.query('UPDATE pms_project_contract SET contract_amount=110 WHERE id=2')
      await blocker.query('BEGIN')
      await blocker.query('SELECT id FROM pms_project_payment_stage WHERE id=5 FOR UPDATE')
      await blocker.query("INSERT INTO pms_project_payment_record(stage_id,payment_amount,payment_month,handler_id) VALUES(5,5,'2026-01',8)")
      const finished = invokeController(contract.update, context, { params: { id: 1 }, body: {
        contract_code: 'TEST', contract_name: '临时合同', supplier_id: 1, signed_date: '2026-01-01', contract_amount: 100,
        stages: [{ id: 3, stage_name: '阶段', planned_amount: 100 }],
      } })
      await pause()
      await blocker.query('COMMIT')
      const result = await finished
      assert.notEqual(result.code, 0)
      assert.match(JSON.stringify(result.fieldErrors), /不能删除/)
      assert.equal((await isolated.query('SELECT is_deleted FROM pms_project_payment_stage WHERE id=5')).rows[0].is_deleted, 0)
    })

    await t.test('MCP ownership is read again after a competing owner transaction commits', async () => {
      const preview = await dispatchActionTool('task_change_priority', { mode: 'preview', id: 4, priority: 2 }, context)
      await blocker.query('BEGIN')
      await blocker.query('SELECT id FROM pms_task WHERE id=4 FOR UPDATE')
      await blocker.query('UPDATE pms_task_owner SET user_id=9 WHERE task_id=4')
      const execution = dispatchActionTool('task_change_priority', preview.executeArguments, context)
      const finished = Promise.allSettled([execution])
      await pause()
      await blocker.query('COMMIT')
      const [result] = await finished
      assert.equal(result.status, 'rejected')
      assert.equal(result.reason.code, 'MCP_ACTION_NOT_RESPONSIBLE')
      assert.equal((await isolated.query('SELECT priority FROM pms_task WHERE id=4')).rows[0].priority, 1)
      assert.equal((await isolated.query('SELECT status FROM pms_mcp_action_ticket WHERE id=$1', [preview.confirmationId])).rows[0].status, 'failed')
    })

    await t.test('HTTP task assignment locks the parent before changing ownership relations', async () => {
      await isolated.query('UPDATE pms_task_owner SET user_id=8 WHERE task_id=4')
      await blocker.query('BEGIN')
      await blocker.query('SELECT id FROM pms_task WHERE id=4 FOR UPDATE')
      const finished = invokeController(taskController.batchAssign, context, { body: { ids: [4], owner_ids: [9] } })
      await pause()
      let relationsAvailable = true
      try { await isolated.query('SELECT user_id FROM pms_task_owner WHERE task_id=4 FOR UPDATE NOWAIT') }
      catch (error) { if (error.code !== '55P03') throw error; relationsAvailable = false }
      await blocker.query('COMMIT')
      const result = await finished
      assert.equal(relationsAvailable, true, 'owner writer must not lock child relations before the task parent')
      assert.equal(result.code, 0)
      assert.equal(Number((await isolated.query('SELECT user_id FROM pms_task_owner WHERE task_id=4')).rows[0].user_id), 9)
    })

    await t.test('two concurrent uses of one legal action ticket write exactly once', async () => {
      await isolated.query('UPDATE pms_task_owner SET user_id=8 WHERE task_id=4')
      const preview = await dispatchActionTool('task_change_priority', { mode: 'preview', id: 4, priority: 2 }, context)
      const results = await Promise.allSettled([1, 2].map(() => dispatchActionTool('task_change_priority', preview.executeArguments, context)))
      assert.equal(results.filter((result) => result.status === 'fulfilled' && result.value.executed).length, 1)
      assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'MCP_CONFIRMATION_ALREADY_USED')
      assert.equal((await isolated.query('SELECT priority FROM pms_task WHERE id=4')).rows[0].priority, 2)
    })

    await t.test('BUG batch rejects every write when one owner changes while waiting', async () => {
      const preview = await dispatchActionTool('bug_assign', { mode: 'preview', ids: [7, 6], assignee_id: 9 }, context)
      await blocker.query('BEGIN')
      await blocker.query('UPDATE pms_bug SET assignee_id=9 WHERE id=6')
      const finished = Promise.allSettled([dispatchActionTool('bug_assign', preview.executeArguments, context)])
      await pause()
      await blocker.query('COMMIT')
      const [result] = await finished
      assert.equal(result.status, 'rejected')
      assert.equal(result.reason.code, 'MCP_ACTION_NOT_RESPONSIBLE')
      assert.equal(Number((await isolated.query('SELECT assignee_id FROM pms_bug WHERE id=7')).rows[0].assignee_id), 8)
    })

    await t.test('item reorder rereads all owners after locks and later permits the legitimate owner', async () => {
      const args = { mode: 'preview', project_id: 1, stage_id: 10, ids: [12, 11], moved_id: 12 }
      const preview = await dispatchActionTool('stage_item_reorder', args, context)
      await blocker.query('BEGIN')
      await blocker.query('UPDATE pms_project_plan_item SET owner_id=9 WHERE id=11')
      const finished = Promise.allSettled([dispatchActionTool('stage_item_reorder', preview.executeArguments, context)])
      await pause()
      await blocker.query('COMMIT')
      const [result] = await finished
      assert.equal(result.status, 'rejected')
      assert.equal(result.reason.code, 'MCP_ACTION_NOT_RESPONSIBLE')
      assert.deepEqual((await isolated.query('SELECT id FROM pms_project_plan_item ORDER BY sort_order,id')).rows.map((row) => Number(row.id)), [11, 12])
      await isolated.query('UPDATE pms_project_plan_item SET owner_id=8 WHERE id=11')
      const legal = await dispatchActionTool('stage_item_reorder', args, context)
      assert.equal((await dispatchActionTool('stage_item_reorder', legal.executeArguments, context)).executed, true)
      assert.deepEqual((await isolated.query('SELECT id FROM pms_project_plan_item ORDER BY sort_order,id')).rows.map((row) => Number(row.id)), [12, 11])
    })
    for (const [tool, table, controller, params, args, firstId] of [
      ['stage_reorder', 'pms_project_plan_stage', stageController.reorderStages, { projectId: 1 }, { project_id: 1, ids: [20, 10], moved_id: 20 }, 20],
      ['stage_item_reorder', 'pms_project_plan_item', stageController.reorderItems, { projectId: 1, stageId: 10 }, { project_id: 1, stage_id: 10, ids: [12, 11], moved_id: 12 }, 12],
    ]) await t.test(`HTTP and MCP ${tool} avoid reverse-order deadlocks and preserve the requested order`, async (st) => {
      if (tool === 'stage_reorder') await isolated.query("INSERT INTO pms_project_plan_stage(id,project_id,name,sort_order) VALUES(20,1,'临时阶段乙',1)")
      else await isolated.query('UPDATE pms_project_plan_item SET sort_order=id-11')
      let firstWrite, resumeHttp, intercepted = false
      const reached = new Promise((resolve) => { firstWrite = resolve })
      const resume = new Promise((resolve) => { resumeHttp = resolve })
      const errors = []
      st.mock.method(console, 'error', (error) => errors.push(error.code || error.message))
      st.mock.method(db.pool, 'connect', async () => {
        const client = await isolated.connect()
        return { query: async (sql, values) => {
          const result = await client.query(sql, values)
          if (!intercepted && sql.startsWith(`UPDATE ${table} SET sort_order=`) && Number(values[2]) === firstId) {
            intercepted = true
            firstWrite()
            await resume
          }
          return result
        }, release: () => client.release() }
      })
      const preview = await dispatchActionTool(tool, { ...args, mode: 'preview' }, context)
      const http = invokeController(controller, context, { params, body: { ids: args.ids, moved_id: args.moved_id } })
      let calls
      try {
        await Promise.race([reached, http.then(() => { throw new Error('HTTP did not reach its first ordered write') })])
        const action = dispatchActionTool(tool, preview.executeArguments, context)
        calls = Promise.allSettled([http, action])
        let waiting = false
        for (let attempt = 0; attempt < 100; attempt++) {
          const result = await admin.query("SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'", [schema])
          if (result.rowCount) { waiting = true; break }
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        assert.equal(waiting, true, 'the competing MCP action must reach the held resource')
        resumeHttp()
        const results = await calls
        assert.deepEqual(errors, [], 'neither channel may encounter a database deadlock')
        assert.equal(results[0].status, 'fulfilled')
        assert.equal(results[0].value.code, 0)
        assert.equal(results[1].status, 'fulfilled')
        assert.equal(results[1].value.executed, true)
        const order = await isolated.query(`SELECT id FROM ${table} ORDER BY sort_order,id`)
        assert.deepEqual(order.rows.map((row) => Number(row.id)), args.ids)
      } finally {
        resumeHttp()
        if (calls) await calls
        else await http
      }
    })
  } catch (error) {
    console.error('Isolated concurrency fixture failed:', error.message)
    throw error
  } finally {
    if (blocker) { await blocker.query('ROLLBACK'); blocker.release() }
    if (isolated) await isolated.end()
    // Generated locally above, strict prefix+random suffix, and owned by this role.
    assert.match(schema, /^mcp_action_test_[a-f0-9]{20}$/)
    const owned = await admin.query('SELECT nspname FROM pg_namespace WHERE nspname=$1 AND nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)', [schema])
    if (owned.rows.length) await admin.query(`DROP SCHEMA ${schema} CASCADE`)
    assert.equal((await admin.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [schema])).rowCount, 0)
    await admin.end()
  }
})
