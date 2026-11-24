const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const enabled = process.env.RUN_DB_INTEGRATION === '1'
const schema = `status_filter_test_${crypto.randomBytes(6).toString('hex')}`
if (enabled) process.env.DB_OPTIONS = `-c search_path=${schema} -c timezone=Asia/Shanghai`

test('真实HTTP/PostgreSQL：六类单据状态多选、统计、分页和详情邻居保持一致', { skip: !enabled }, async t => {
  const db = require('../src/db')
  let server
  let schemaCreated = false
  try {
    assert.equal(process.env.INTEGRATION_DB_ISOLATED, '1', '状态筛选测试必须使用隔离环境')
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
    const response = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account: 'admin', password: 'vv123456', ...await readCaptcha(origin) }) })
    const session = await response.json()
    assert.equal(session.code, 0)
    const get = async (endpoint, query) => {
      const response = await fetch(origin + '/api' + endpoint + '?' + new URLSearchParams(query), { headers: { authorization: 'Bearer ' + session.data.token } })
      const result = await response.json()
      assert.equal(result.code, 0, endpoint + ': ' + JSON.stringify(result))
      return result.data
    }
    const archive = await db.prepare('SELECT id FROM pms_archive WHERE is_deleted=0 ORDER BY id LIMIT 1').get()
    const product = await db.prepare("INSERT INTO pms_product(name,owner_id)VALUES('fixture-container',1)").run()
    const project = await db.prepare("INSERT INTO pms_project(name,product_id,owner_id,expected_end_date)VALUES('fixture-container',?,1,CURRENT_DATE)").run(product.lastInsertRowid)
    const fixtures = [
      { endpoint: '/products', field: 'name', states: [0, 1], sql: 'INSERT INTO pms_product(name,status,owner_id,creator_id)VALUES(?,?,1,1)', args: [] },
      { endpoint: '/requirements', field: 'title', states: [0, 31, 33], sql: "INSERT INTO pms_requirement(title,status,requirement_type,product_id,owner_id,submitter_name,submit_date,creator_id)VALUES(?,?,1,?,1,'隔离验收',CURRENT_DATE,1)", args: [product.lastInsertRowid] },
      { endpoint: '/projects', field: 'name', states: [0, 1, 2], sql: 'INSERT INTO pms_project(name,status,product_id,owner_id,expected_end_date,creator_id)VALUES(?,?,?,1,CURRENT_DATE,1)', args: [product.lastInsertRowid] },
      { endpoint: '/tasks', field: 'name', states: [0, 1, 2], sql: 'INSERT INTO pms_task(name,status,source_type,task_type,creator_id)VALUES(?,?,3,?,1)', args: [archive.id] },
      { endpoint: '/bugs', field: 'title', states: [0, 1, 2], sql: 'INSERT INTO pms_bug(title,status,source_type,project_id,bug_type_id,severity,assignee_id,creator_id)VALUES(?,?,1,?,?,1,1,1)', args: [project.lastInsertRowid, archive.id] },
      { endpoint: '/work-orders', field: 'problem_desc', states: [0, 1, 2], sql: "INSERT INTO pms_work_order(problem_desc,status,product_id,problem_type,follower_id,submitter_name,submitter_dept,submit_time,creator_id)VALUES(?,?,?,?,1,'隔离验收','测试',NOW(),1)", args: [product.lastInsertRowid, archive.id] }
    ]
    for (const fixture of fixtures) {
      fixture.prefix = `multi-status-${fixture.endpoint.slice(1)}-`
      fixture.ids = []
      for (const state of fixture.states) {
        const record = await db.prepare(fixture.sql).run(fixture.prefix + state, state, ...fixture.args)
        fixture.ids.push(Number(record.lastInsertRowid))
        if (fixture.endpoint === '/tasks') await db.prepare('INSERT INTO pms_task_owner(task_id,user_id)VALUES(?,1) RETURNING task_id').get(record.lastInsertRowid)
      }
      await t.test(fixture.endpoint, async () => {
        const selected = fixture.states.slice(0, 2)
        const query = { [fixture.field]: fixture.prefix, status: selected.join(','), sort_field: 'status', sort_order: 'ascend', view: 'all', current_user_id: 1 }
        const filtered = await get(fixture.endpoint, query)
        assert.equal(filtered.total, 2)
        assert.deepEqual(filtered.list.map(row => Number(row.status)), selected)
        const descending = await get(fixture.endpoint, { ...query, sort_order: 'descend' })
        assert.deepEqual(descending.list.map(row => Number(row.status)), selected.slice().reverse())
        if (filtered.viewCounts) assert.equal(filtered.viewCounts.all, 2)
        const second = await get(fixture.endpoint, { ...query, page: 2, pageSize: 1 })
        assert.equal(second.total, 2)
        assert.equal(Number(second.list[0].status), selected[1])
        const legacy = await get(fixture.endpoint, { ...query, status: '0' })
        assert.deepEqual(legacy.list.map(row => Number(row.status)), [0])
        assert.equal((await get(fixture.endpoint, { ...query, status: '' })).total, fixture.states.length)
        assert.equal((await get(fixture.endpoint, { ...query, status: '0 OR 1=1' })).total, 0)
        if (!['/products', '/projects'].includes(fixture.endpoint)) {
          const neighbors = await get(fixture.endpoint + '/neighbors', { ...query, id: fixture.ids[0] })
          assert.equal(Number(neighbors.total), 2)
          assert.equal(Number(neighbors.nextId), fixture.ids[1])
        }
      })
    }
    const other = await db.prepare("INSERT INTO pms_user(employee_no,real_name,phone,password,status,first_login)VALUES('filter-other','其他负责人','13900000001',?,1,0)").run(password)
    const mixedTasks = []
    const addTask = async (suffix, status, parentIndex, owner = 1) => {
      const task = await db.prepare('INSERT INTO pms_task(name,status,parent_task_id,source_type,task_type,creator_id)VALUES(?,?,?,3,?,1)').run(`mixed-status-${mixedTasks.length}-${suffix}`, status, parentIndex === undefined ? null : mixedTasks[parentIndex].id, archive.id)
      const id = Number(task.lastInsertRowid)
      await db.prepare('INSERT INTO pms_task_owner(task_id,user_id)VALUES(?,?) RETURNING task_id').get(id, owner)
      mixedTasks.push({ id, status, owner })
    }
    await addTask('处理中主任务', 1, undefined, Number(other.lastInsertRowid))
    await addTask('暂停子任务', 3, 0)
    await addTask('关闭子任务', 4, 0, Number(other.lastInsertRowid))
    await addTask('完成子任务', 2, 0)
    await addTask('暂停主任务', 3)
    await addTask('处理中子任务', 1, 4)
    await addTask('同状态子任务', 3, 4)
    await addTask('关闭独立任务', 4)
    await addTask('待处理独立任务', 0)
    await t.test('父子状态混合：所有单值和状态组合严格命中，分页、统计和上下条同序', async () => {
      const codes = [0, 1, 2, 3, 4]
      const selections = [...codes.map(code => [code]), ...codes.flatMap((code, index) => codes.slice(index + 1).map(next => [code, next])), codes]
      for (const selected of selections) for (const view of ['all', 'mine']) for (const order of ['ascend', 'descend']) {
        const expected = mixedTasks.filter(row => selected.includes(row.status) && (view === 'all' || row.owner === 1))
        if (order === 'descend') expected.reverse()
        const query = { name: 'mixed-status-', status: selected.join(','), view, sort_field: 'name', sort_order: order, pageSize: 2 }
        const rows = []
        for (let page = 1; page <= Math.max(1, Math.ceil(expected.length / 2)); page++) {
          const result = await get('/tasks', { ...query, page })
          assert.equal(result.total, expected.length, JSON.stringify(query))
          assert.equal(result.viewCounts.all, mixedTasks.filter(row => selected.includes(row.status)).length)
          assert.equal(result.viewCounts.mine, mixedTasks.filter(row => selected.includes(row.status) && row.owner === 1).length)
          assert.ok(result.list.every(row => selected.includes(Number(row.status))), '不得补入不匹配的主任务')
          rows.push(...result.list)
        }
        assert.deepEqual(rows.map(row => Number(row.id)), expected.map(row => row.id))
        for (const [index, record] of expected.entries()) {
          const neighbors = await get('/tasks/neighbors', { ...query, id: record.id })
          assert.equal(Number(neighbors.total), expected.length)
          assert.equal(Number(neighbors.ordinal), index + 1)
          assert.equal(neighbors.prevId === null ? null : Number(neighbors.prevId), expected[index - 1]?.id ?? null)
          assert.equal(neighbors.nextId === null ? null : Number(neighbors.nextId), expected[index + 1]?.id ?? null)
        }
      }
      const unfiltered = await get('/tasks', { name: 'mixed-status-', sort_field: 'name', sort_order: 'ascend' })
      assert.equal(unfiltered.total, 4, '清空状态后保留父子组分页')
      assert.equal(unfiltered.list.length, mixedTasks.length)
      const excludedParent = await get('/tasks/neighbors', { name: 'mixed-status-', status: '3,4', id: mixedTasks[0].id })
      assert.equal(Number(excludedParent.total), 0)
    })
    if (process.env.STATUS_FILTER_BROWSER_SCRIPT) await require(process.env.STATUS_FILTER_BROWSER_SCRIPT)({ session: session.data, origin, fixtures, mixedTasks })
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    if (schemaCreated) await db.exec(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    await db.pool.end()
  }
})
