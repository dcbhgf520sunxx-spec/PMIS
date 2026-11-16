const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const enabled = process.env.RUN_DB_INTEGRATION === '1'
const schema = `reschedule_test_${crypto.randomBytes(6).toString('hex')}`
if (enabled) process.env.DB_OPTIONS = `-c search_path=${schema} -c timezone=Asia/Shanghai`

test('真实HTTP/PostgreSQL：各改期入口保存固定逾期天数并按同次操作回读', { skip: !enabled }, async (t) => {
  const db = require('../src/db')
  let server
  let schemaCreated = false
  try {
    assert.equal(process.env.INTEGRATION_DB_ISOLATED, '1', '改期集成测试必须连接隔离测试数据库')
    assert.ok(['localhost', '127.0.0.1', '::1'].includes(db.pool.options.host))
    await db.exec(`CREATE SCHEMA ${schema}`)
    schemaCreated = true
    await db.exec(fs.readFileSync(path.join(__dirname, '../db/init/001_schema.sql'), 'utf8').replace(/^ALTER (DATABASE|ROLE).*$/gm, ''))
    await db.prepare("UPDATE pms_user SET password=?,first_login=0 WHERE employee_no='admin'").run(await require('bcryptjs').hash('vv123456', 4))
    const readCaptcha = require('../test-support/loginCaptcha').captureLoginCaptcha(t)
    server = require('../src/app').listen(process.env.RESCHEDULE_BROWSER_SCRIPT ? 3103 : 0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    const origin = `http://127.0.0.1:${server.address().port}`
    const login = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account: 'admin', password: 'vv123456', ...await readCaptcha(origin) }) })
    const session = await login.json()
    assert.equal(session.code, 0)
    const request = async (endpoint, body, method = 'PUT') => {
      const response = await fetch(origin + '/api' + endpoint, { method, headers: { authorization: 'Bearer ' + session.data.token, 'content-type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) })
      const result = await response.json()
      assert.equal(result.code, 0, endpoint + ': ' + JSON.stringify(result))
      return result.data
    }
    const today = require('../src/utils/date').getShanghaiDateText()
    const day = offset => new Date(Date.parse(today + 'T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10)
    const oldDate = day(-3), nextDate = day(4), laterDate = day(7)
    const product = (await db.prepare("INSERT INTO pms_product(name,owner_id) VALUES('改期留痕隔离产品',1)").run()).lastInsertRowid
    const requirement = async title => (await db.prepare("INSERT INTO pms_requirement(title,requirement_type,product_id,owner_id,status,submitter_name,submit_date,expected_end_date,is_overdue) VALUES(?,4,?,1,31,'隔离验收',?,?,0)").run(title, product, today, oldDate)).lastInsertRowid
    const requirementId = await requirement('改期留痕需求')
    const sourceRequirement = await requirement('项目来源需求')
    await db.prepare('UPDATE pms_requirement SET status=36 WHERE id=?').run(sourceRequirement)
    const projectId = (await db.prepare("INSERT INTO pms_project(name,product_id,requirement_id,owner_id,status,expected_end_date,is_overdue) VALUES('改期留痕项目',?,?,1,1,?,0)").run(product, sourceRequirement, oldDate)).lastInsertRowid
    const taskType = await db.prepare("SELECT a.id FROM pms_archive a JOIN pms_archive_type t ON t.id=a.archive_type_id WHERE t.code='task_type' ORDER BY a.id LIMIT 1").get()
    const taskId = (await db.prepare("INSERT INTO pms_task(name,source_type,task_type,status,expected_end_date,is_overdue) VALUES('改期留痕任务',3,?,1,?,0)").run(taskType.id, oldDate)).lastInsertRowid
    await db.exec('INSERT INTO pms_task_owner(task_id,user_id) VALUES(?,1)', [taskId])
    const problemType = await db.prepare("SELECT a.id FROM pms_archive a JOIN pms_archive_type t ON t.id=a.archive_type_id WHERE t.code_prefix='PT' ORDER BY a.id LIMIT 1").get()
    const workOrderId = (await db.prepare("INSERT INTO pms_work_order(product_id,problem_type,problem_desc,follower_id,status,expected_resolve_date,is_overdue,submitter_name,submitter_dept,submit_time) VALUES(?,?,'改期留痕工单',1,1,?,0,'隔离验收','隔离组织',CURRENT_DATE)").run(product, problemType.id, oldDate)).lastInsertRowid
    const stageId = (await db.prepare("INSERT INTO pms_project_plan_stage(project_id,name) VALUES(?,'隔离阶段')").run(projectId)).lastInsertRowid
    const itemId = (await db.prepare("INSERT INTO pms_project_plan_item(stage_id,name,owner_id,original_due_date,current_due_date,status) VALUES(?,'改期留痕关键事项',1,?,?,1)").run(stageId, oldDate, oldDate)).lastInsertRowid
    const cases = [
      { module: '需求', id: requirementId, route: '/requirements/' + requirementId, dateField: 'expected_end_date', body: { title: '改期留痕需求', requirement_type: 4, product_id: product, owner_id: 1, submitter_name: '隔离验收', submit_date: today } },
      { module: '项目', id: projectId, route: '/projects/' + projectId, dateField: 'expected_end_date', body: { name: '改期留痕项目', product_id: product, requirement_id: sourceRequirement, owner_id: 1, member_ids: [] } },
      { module: '任务', id: taskId, route: '/tasks/' + taskId, dateField: 'expected_end_date', body: { name: '改期留痕任务', source_type: 3, owner_ids: [1], task_type: taskType.id } },
      { module: '运维工单', id: workOrderId, route: '/work-orders/' + workOrderId, dateField: 'expected_resolve_date', body: { product_id: product, problem_type: problemType.id, problem_desc: '改期留痕工单', follower_id: 1, urgency: 1, submitter_name: '隔离验收', submitter_dept: '隔离组织', submit_time: today } },
      { module: '项目阶段主计划', id: itemId, route: `/projects/${projectId}/stage-plan/items/${itemId}/adjustments`, dateField: 'new_due_date', body: { reason: '隔离验收改期' }, method: 'POST', history: `/projects/${projectId}/stage-plan/history` },
    ]
    await t.test('日志失败时需求、工单和阶段改期必须回滚，重试仍能记录原逾期', async (failureTest) => {
      failureTest.mock.method(console, 'error', () => {})
      await db.exec(`CREATE FUNCTION reject_reschedule_log() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.field_name='reschedule_overdue_days' THEN RAISE EXCEPTION 'isolated snapshot failure'; END IF; RETURN NEW; END $$`)
      for (const item of cases.filter(item => ['需求', '运维工单', '项目阶段主计划'].includes(item.module))) {
        await db.exec('CREATE TRIGGER reject_reschedule_log BEFORE INSERT ON pms_op_log FOR EACH ROW EXECUTE FUNCTION reject_reschedule_log()')
        try {
          const response = await fetch(origin + '/api' + item.route, { method: item.method || 'PUT', headers: { authorization: 'Bearer ' + session.data.token, 'content-type': 'application/json' }, body: JSON.stringify({ ...item.body, [item.dateField]: nextDate }) })
          assert.equal(response.status, 500)
        } finally { await db.exec('DROP TRIGGER reject_reschedule_log ON pms_op_log') }
        const [table, dateField] = item.module === '需求' ? ['pms_requirement', 'expected_end_date'] : item.module === '运维工单' ? ['pms_work_order', 'expected_resolve_date'] : ['pms_project_plan_item', 'current_due_date']
        const actual = await db.prepare(`SELECT ${dateField}::date AS due FROM ${table} WHERE id=?`).get(item.id)
        assert.equal(actual.due, oldDate, item.module + '日志失败不能留下已修改的日期')
        assert.equal((await db.prepare('SELECT COUNT(*)::integer AS count FROM pms_op_log WHERE module=? AND target_id=?').get(item.module, item.id)).count, 0)
      }
    })
    for (const item of cases) await t.test(item.module + '改期、再次调整与历史回读', async () => {
      const logs = () => db.prepare('SELECT * FROM pms_op_log WHERE module=? AND target_id=? ORDER BY id').all(item.module, item.id)
      await request(item.route, { ...item.body, [item.dateField]: nextDate }, item.method)
      const rows = await logs()
      const snapshot = rows.find(row => row.field_name === 'reschedule_overdue_days')
      assert.ok(snapshot, item.module)
      assert.equal(snapshot.new_value, '3天')
      assert.equal(snapshot.user_id, '1')
      assert.equal(new Set(rows.map(row => row.operation_id)).size, 1)
      assert.ok(snapshot.operation_id)
      assert.ok(rows.some(row => row.old_value?.startsWith(oldDate) && row.new_value?.startsWith(nextDate)))
      const history = await request(item.history || item.route + '/history', undefined, 'GET')
      assert.match(JSON.stringify(history), /改期前已逾期/)
      assert.match(JSON.stringify(history), /3天/)
      assert.doesNotMatch(JSON.stringify(history.flatMap(row => row.changes || row.details || [])), /reschedule_overdue_days|其他字段/)
      await request(item.route, { ...item.body, [item.dateField]: laterDate }, item.method)
      assert.deepEqual((await logs()).filter(row => row.field_name === 'reschedule_overdue_days'), [snapshot], '新计划未到期，再次改期不新增或改变原快照')
    })
    const { saveRequirement, saveWorkOrder } = require('../src/services/itopsSyncService')
    for (const type of ['requirement', 'work_order']) await t.test('i8同步' + type + '按修改前状态保留逾期', async () => {
      const id = type === 'requirement' ? await requirement('同步改期留痕需求') : (await db.prepare("INSERT INTO pms_work_order(product_id,problem_type,problem_desc,follower_id,status,expected_resolve_date,submitter_name,submitter_dept,submit_time) VALUES(?,?,'同步改期留痕工单',1,1,?,'隔离验收','隔离组织',CURRENT_DATE)").run(product, problemType.id, oldDate)).lastInsertRowid
      const old = await db.prepare(`SELECT * FROM pms_${type} WHERE id=?`).get(id)
      const mapped = { title: old.title, externalCode: 'ISOLATED', syncedSection: '<p>隔离同步</p>', problemDescription: '同步改期留痕工单', problemTypeName: '其他', status: type === 'requirement' ? 33 : 2, priority: 1, expectedEndDate: nextDate, actualEndDate: today, submitDate: today, submitterName: '隔离验收', submitterDept: '隔离组织', completionStatus: '已处理' }
      await db.transaction(tx => (type === 'requirement' ? saveRequirement : saveWorkOrder)(tx, mapped, { product_id: product }, { id: 1 }, old, 1))
      const logs = await db.prepare('SELECT * FROM pms_op_log WHERE module=? AND target_id=?').all(type === 'requirement' ? '需求' : '运维工单', id)
      assert.equal(logs.find(row => row.field_name === 'reschedule_overdue_days')?.new_value, '3天')
      assert.equal(new Set(logs.map(row => row.operation_id)).size, 1)
    })
    for (const item of cases.filter(item => item.module !== '项目')) await t.test(item.module + '并发改期只接受一个旧版本，不重复保存逾期快照', { timeout: 15000 }, async concurrencyTest => {
      const [table, field, selectPattern] = item.module === '需求'
        ? ['pms_requirement', 'expected_end_date', /SELECT \* FROM pms_requirement WHERE id=\? AND is_deleted=0/]
        : item.module === '任务'
          ? ['pms_task', 'expected_end_date', /SELECT \* FROM pms_task WHERE id=\? AND is_deleted=0/]
          : item.module === '运维工单'
            ? ['pms_work_order', 'expected_resolve_date', /SELECT product_id,.*FROM pms_work_order WHERE id = \? AND is_deleted = 0/]
            : ['pms_project_plan_item', 'current_due_date', /SELECT i\.\*,s\.project_id/]
      await db.exec(`UPDATE ${table} SET ${field}=?,updated_at=NOW() WHERE id=?`, [oldDate, item.id])
      const before = await db.prepare('SELECT COUNT(*)::integer count FROM pms_op_log WHERE module=? AND target_id=? AND field_name=?').get(item.module, item.id, 'reschedule_overdue_days')
      const prepare = db.prepare
      let reads = 0, release
      const bothRead = new Promise(resolve => { release = resolve })
      concurrencyTest.mock.method(db, 'prepare', sql => {
        const statement = prepare(sql)
        if (!selectPattern.test(sql.replace(/\s+/g, ' '))) return statement
        return { ...statement, get: async (...params) => {
          const row = await statement.get(...params)
          if (++reads === 2) release()
          await bothRead
          return row
        } }
      })
      const responses = await Promise.all([nextDate, laterDate].map(date => fetch(origin + '/api' + item.route, {
        method: item.method || 'PUT', headers: { authorization: 'Bearer ' + session.data.token, 'content-type': 'application/json' }, body: JSON.stringify({ ...item.body, [item.dateField]: date }),
      })))
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 409])
      const snapshots = await prepare('SELECT * FROM pms_op_log WHERE module=? AND target_id=? AND field_name=? ORDER BY id').all(item.module, item.id, 'reschedule_overdue_days')
      assert.equal(snapshots.length, before.count + 1)
      assert.equal(snapshots.at(-1).new_value, '3天')
      const operation = await prepare('SELECT field_name,old_value FROM pms_op_log WHERE operation_id=?').all(snapshots.at(-1).operation_id)
      assert.ok(operation.some(change => change.field_name === field && change.old_value.startsWith(oldDate)))
    })
    const rejected = await fetch(origin + '/api/tasks/' + taskId, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expected_end_date: nextDate }) })
    assert.equal(rejected.status, 401)
    if (process.env.RESCHEDULE_BROWSER_SCRIPT) {
      await require(process.env.RESCHEDULE_BROWSER_SCRIPT)({ session: session.data, ids: { requirementId, projectId, taskId, workOrderId }, origin })
    }
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    if (schemaCreated) await db.exec(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    await db.pool.end()
  }
})
