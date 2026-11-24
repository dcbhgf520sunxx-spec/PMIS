const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const { randomBytes } = require('node:crypto')

const enabled = process.env.RUN_DB_INTEGRATION === '1'
const schema = `project_overdue_test_${randomBytes(6).toString('hex')}`
if (enabled) process.env.DB_OPTIONS = `-c search_path=${schema} -c timezone=Asia/Shanghai`

test('项目和关键事项逾期独立筛选，数量、分页与阶段明细一致', { skip: !enabled }, async t => {
  const db = require('../src/db')
  let server
  let schemaCreated = false
  try {
    assert.equal(process.env.INTEGRATION_DB_ISOLATED, '1')
    assert.ok(['localhost', '127.0.0.1', '::1'].includes(db.pool.options.host))
    await db.exec(`CREATE SCHEMA ${schema}`)
    schemaCreated = true
    await db.exec(fs.readFileSync(path.join(__dirname, '../db/init/001_schema.sql'), 'utf8').replace(/^ALTER (DATABASE|ROLE).*$/gm, ''))
    const password = await require('bcryptjs').hash('vv123456', 4)
    await db.prepare("UPDATE pms_user SET password=?,first_login=0 WHERE employee_no='admin'").run(password)
    const readCaptcha = require('../test-support/loginCaptcha').captureLoginCaptcha(t)
    server = require('../src/app').listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    const origin = `http://127.0.0.1:${server.address().port}`
    const login = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account: 'admin', password: 'vv123456', ...await readCaptcha(origin) }) })
    const session = await login.json()
    assert.equal(session.code, 0)
    const get = async (endpoint, query = {}, expectedStatus = 200) => {
      const response = await fetch(origin + '/api' + endpoint + '?' + new URLSearchParams(query), { headers: { authorization: 'Bearer ' + session.data.token } })
      const result = await response.json()
      assert.equal(response.status, expectedStatus, JSON.stringify(result))
      return result.data
    }
    const product = (await db.prepare("INSERT INTO pms_product(name,owner_id)VALUES('逾期验收产品',1)").run()).lastInsertRowid
    const other = (await db.prepare("INSERT INTO pms_user(employee_no,real_name,phone,password)VALUES('plan-owner','事项负责人','13900000008',?)").run(password)).lastInsertRowid
    const project = async (name, due, status = 1, owner = 1) => Number((await db.prepare('INSERT INTO pms_project(name,product_id,owner_id,expected_end_date,status)VALUES(?,?,?,CURRENT_DATE+?::INTEGER,?)').run(`事项验收-${name}`, product, owner, due, status)).lastInsertRowid)
    const stage = async (id, name, deleted = 0) => (await db.prepare('INSERT INTO pms_project_plan_stage(project_id,name,is_deleted)VALUES(?,?,?)').run(id, name, deleted)).lastInsertRowid
    const item = (id, name, due, status = 1, deleted = 0) => db.prepare(`INSERT INTO pms_project_plan_item(stage_id,name,owner_id,original_due_date,current_due_date,status,is_deleted,pause_reason)
      VALUES(?,?,?,CURRENT_DATE-10,CURRENT_DATE+?::INTEGER,?,?,?)`).run(id, name, other, due, status, deleted, status === 3 ? '暂停验收' : null)

    const ahead = await project('项目未逾期但事项逾期', 5)
    const design = await stage(ahead, '设计阶段')
    await item(design, '确认设计', -5)
    await item(design, '当日截止', 0)
    await item(design, '已完成事项', -2, 2)
    await item(design, '已暂停事项', -2, 3)
    await item(design, '已删除事项', -2, 1, 1)
    await item(await stage(ahead, '验证阶段'), '验证接口', -2, 0)
    await item(await stage(ahead, '已删除阶段', 1), '无效阶段事项', -8)
    const healthy = await project('事项未逾期', 5)
    await item(await stage(healthy, '已改期阶段'), '已改到未来', 3)
    const empty = await project('未设置事项', 5)
    await stage(empty, '空阶段')
    const ownLate = await project('单独项目逾期', -1)
    const both = await project('两者逾期', -1, 1, other)
    await item(await stage(both, '实施阶段'), '已逾期', -1)
    await db.prepare('INSERT INTO pms_project_member(project_id,user_id)VALUES(?,1)').run(both)
    const paused = await project('项目暂停', -1, 3)
    await item(await stage(paused, '暂停时不计逾期'), '暂停项目的事项', -4)
    const closed = await project('项目关闭', -1, 4)
    await item(await stage(closed, '关闭时不计逾期'), '关闭项目的事项', -4)

    const list = (query = {}) => get('/projects', { name: '事项验收-', current_user_id: 1, ...query })
    const ids = result => result.list.map(row => Number(row.id)).sort((a, b) => a - b)
    const overdue = await list({ plan_item_overdue: 1, sort_field: 'overduePlanItemCount', sort_order: 'descend', pageSize: 1 })
    assert.equal(overdue.total, 2)
    assert.deepEqual(overdue.viewCounts, { all: 2, mine: 1, joined: 1 })
    assert.deepEqual(ids(overdue), [ahead])
    assert.equal(overdue.list[0].overdue_plan_item_count, 2)
    assert.deepEqual(ids(await list({ plan_item_overdue: 1, sort_field: 'overduePlanItemCount', sort_order: 'descend', pageSize: 1, page: 2 })), [both])
    assert.deepEqual(ids(await list({ plan_item_overdue: 1, is_overdue: 0 })), [ahead])
    assert.deepEqual(ids(await list({ plan_item_overdue: 1, is_overdue: 1 })), [both])
    assert.deepEqual(ids(await list({ plan_item_overdue: 1, joined_user_id: 1 })), [both])
    assert.deepEqual(ids(await list({ is_overdue: 1 })), [ownLate, both])
    assert.deepEqual(ids(await list({ plan_item_overdue: 0 })), [healthy, paused, closed])
    const all = await list({ sort_field: 'overduePlanItemCount', sort_order: 'ascend' })
    assert.deepEqual(all.list.map(row => row.overdue_plan_item_count), [0, 0, 0, 1, 2, null, null])
    assert.equal(all.list.find(row => Number(row.id) === empty).overdue_plan_item_count, null)
    const plan = await get(`/projects/${ahead}/stage-plan`)
    assert.equal(plan.stages.reduce((total, row) => total + row.overdue_count, 0), overdue.list[0].overdue_plan_item_count)
    const overdueItems = plan.stages.flatMap(row => row.items.filter(i => i.progress_hint?.startsWith('已逾期')))
    assert.deepEqual(overdueItems.map(i => [i.name, i.progress_hint]), [['确认设计', '已逾期 5 天'], ['验证接口', '已逾期 2 天']])
    await get('/projects', { plan_item_overdue: 'invalid' }, 400)
    if (process.env.PROJECT_OVERDUE_BROWSER_SCRIPT) await require(process.env.PROJECT_OVERDUE_BROWSER_SCRIPT)({ session: session.data, origin })
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    if (schemaCreated) await db.exec(`DROP SCHEMA ${schema} CASCADE`)
    await db.pool.end()
  }
})
