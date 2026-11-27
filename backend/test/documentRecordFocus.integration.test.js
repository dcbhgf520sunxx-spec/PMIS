const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { randomBytes } = require('node:crypto')

const enabled = process.env.RUN_DB_INTEGRATION === '1'
const schema = `record_focus_test_${randomBytes(6).toString('hex')}`
if (enabled) process.env.DB_OPTIONS = `-c search_path=${schema} -c timezone=Asia/Shanghai`

test('真实 HTTP/PostgreSQL：六类单据同状态更新时间排序、批量定位、筛选和分页一致', { skip: !enabled }, async t => {
  const db = require('../src/db')
  let server
  let created = false
  try {
    assert.equal(process.env.INTEGRATION_DB_ISOLATED, '1')
    assert.ok(['localhost', '127.0.0.1', '::1'].includes(db.pool.options.host))
    await db.exec(`CREATE SCHEMA ${schema}`)
    created = true
    await db.exec(fs.readFileSync(path.join(__dirname, '../db/init/001_schema.sql'), 'utf8').replace(/^ALTER (DATABASE|ROLE).*$/gm, ''))
    const password = await require('bcryptjs').hash('vv123456', 4)
    await db.prepare("UPDATE pms_user SET password=?,first_login=0 WHERE employee_no='admin'").run(password)
    const captcha = require('../test-support/loginCaptcha').captureLoginCaptcha(t)
    server = require('../src/app').listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    const origin = `http://127.0.0.1:${server.address().port}`
    const session = await (await fetch(origin + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account: 'admin', password: 'vv123456', ...await captcha(origin) }) })).json()
    assert.equal(session.code, 0)
    const get = async (endpoint, query, expectedStatus = 200, token = session.data.token) => {
      const response = await fetch(origin + '/api' + endpoint + '?' + new URLSearchParams(query), { headers: token ? { authorization: 'Bearer ' + token } : {} })
      const result = await response.json()
      assert.equal(response.status, expectedStatus, endpoint + ': ' + JSON.stringify(result))
      if (expectedStatus === 200) assert.equal(result.code, 0)
      return result.data
    }
    const archive = (await db.prepare('SELECT id FROM pms_archive WHERE is_deleted=0 ORDER BY id LIMIT 1').get()).id
    const product = (await db.prepare("INSERT INTO pms_product(name,owner_id)VALUES('focus-container',1)").run()).lastInsertRowid
    const project = (await db.prepare("INSERT INTO pms_project(name,product_id,owner_id,expected_end_date)VALUES('focus-container',?,1,CURRENT_DATE)").run(product)).lastInsertRowid
    const other = (await db.prepare("INSERT INTO pms_user(employee_no,real_name,phone,password,first_login)VALUES('focus-other','其他人员','13900000009',?,0)").run(password)).lastInsertRowid
    const otherSession = await (await fetch(origin + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account: 'focus-other', password: 'vv123456', ...await captcha(origin) }) })).json()
    assert.equal(otherSession.code, 0)
    const fixtures = [
      { endpoint: '/products', table: 'pms_product', field: 'name', owner: 'owner_id', sql: 'INSERT INTO pms_product(name,status,updated_at,owner_id,creator_id)VALUES(?,?,?,1,1)', args: [] },
      { endpoint: '/requirements', table: 'pms_requirement', field: 'title', owner: 'owner_id', sql: "INSERT INTO pms_requirement(title,status,updated_at,requirement_type,product_id,owner_id,submitter_name,submit_date,creator_id)VALUES(?,?,?,1,?,1,'验收',CURRENT_DATE,1)", args: [product] },
      { endpoint: '/projects', table: 'pms_project', field: 'name', owner: 'owner_id', sql: 'INSERT INTO pms_project(name,status,updated_at,product_id,owner_id,expected_end_date,creator_id)VALUES(?,?,?,?,1,CURRENT_DATE,1)', args: [product] },
      { endpoint: '/tasks', table: 'pms_task', field: 'name', sql: 'INSERT INTO pms_task(name,status,updated_at,source_type,task_type,creator_id)VALUES(?,?,?,3,?,1)', args: [archive] },
      { endpoint: '/bugs', table: 'pms_bug', field: 'title', owner: 'assignee_id', sql: 'INSERT INTO pms_bug(title,status,updated_at,source_type,project_id,bug_type_id,severity,assignee_id,creator_id)VALUES(?,?,?,1,?,?,1,1,1)', args: [project, archive] },
      { endpoint: '/work-orders', table: 'pms_work_order', field: 'problem_desc', owner: 'follower_id', sql: "INSERT INTO pms_work_order(problem_desc,status,updated_at,product_id,problem_type,follower_id,submitter_name,submitter_dept,submit_time,creator_id)VALUES(?,?,?,?,?,1,'验收','测试',NOW(),1)", args: [product, archive] }
    ]
    for (const fixture of fixtures) await t.test(fixture.endpoint, async () => {
      const ids = []
      const prefix = `focus-${fixture.table}-`
      // 同状态故意交错创建与更新时间，防止只按 ID 排序也能通过。
      for (const [index, state, updated] of [[0, 0, '2026-01-01'], [1, 0, '2026-01-03'], [2, 0, '2026-01-02'], [3, 1, '2026-01-04']]) {
        ids.push(Number((await db.prepare(fixture.sql).run(prefix + index, state, updated, ...fixture.args)).lastInsertRowid))
      }
      if (fixture.owner) await db.prepare(`UPDATE ${fixture.table} SET ${fixture.owner}=? WHERE id=?`).run(other, ids[1])
      else for (const [index, id] of ids.entries()) await db.prepare('INSERT INTO pms_task_owner(task_id,user_id)VALUES(?,?) RETURNING task_id').get(id, index === 1 ? other : 1)
      const query = { [fixture.field]: prefix, sort_field: 'status', sort_order: 'ascend', pageSize: 2 }
      const first = await get(fixture.endpoint, query)
      const second = await get(fixture.endpoint, { ...query, page: 2 })
      assert.deepEqual([...first.list, ...second.list].map(row => Number(row.id)), [ids[1], ids[2], ids[0], ids[3]])
      const batch = await get(fixture.endpoint + '/neighbors', { ...query, id: ids[3], ids: `${ids[0]},${ids[2]},${ids[2]}` })
      assert.equal(Number(batch.id), ids[2], '按当前排序选择批量中最靠前记录，不按请求顺序')
      assert.equal(Number(batch.ordinal), 2)
      assert.equal(Number(batch.total), 4)
      assert.equal(Number(batch.page), 1)
      assert.equal(Number(batch.prevId), ids[1])
      assert.equal(Number(batch.nextId), ids[0])
      assert.equal(typeof batch.prevId, 'string', '保留 PostgreSQL BIGINT 相邻记录的原有字符串类型')
      assert.equal(typeof batch.nextId, 'string', '新增定位字段不改变既有相邻记录类型')
      const single = await get(fixture.endpoint + '/neighbors', { ...query, id: ids[0] })
      assert.equal(Number(single.id), ids[0])
      assert.equal(Number(single.page), 2)
      const scoped = { ...query, status: '0', ids: `${ids[1]},${ids[0]}` }
      if (fixture.endpoint === '/products') scoped.owner_ids = '1'
      else if (fixture.endpoint === '/projects') scoped.owner_id = '1'
      else if (fixture.endpoint === '/work-orders') Object.assign(scoped, { view_key: 'mine', current_user_id: 1 })
      else scoped.view = 'mine'
      const scopedRows = await get(fixture.endpoint, scoped)
      assert.deepEqual(scopedRows.list.map(row => Number(row.id)), [ids[2], ids[0]])
      const scopedPosition = await get(fixture.endpoint + '/neighbors', scoped)
      assert.equal(Number(scopedPosition.id), ids[0])
      assert.equal(Number(scopedPosition.ordinal), 2)
      assert.equal(Number(scopedPosition.total), 2)
      assert.equal(Number(scopedPosition.page), 1)
      const excluded = await get(fixture.endpoint + '/neighbors', { ...query, status: '1', ids: `${ids[1]},${ids[0]}` })
      assert.equal(excluded.id, null)
      if (fixture.endpoint === '/requirements') {
        const conflictingOwners = { ...query, owner_id: other, filter_owner_id: 1, ids: ids.join(',') }
        assert.equal((await get(fixture.endpoint, conflictingOwners)).total, 0)
        assert.equal((await get(fixture.endpoint + '/neighbors', conflictingOwners)).id, null, '定位不能用筛选负责人覆盖列表负责人交集')
      }
      const descending = await get(fixture.endpoint, { ...query, sort_order: 'descend', pageSize: 20 })
      assert.deepEqual(descending.list.map(row => Number(row.id)), [ids[3], ids[1], ids[2], ids[0]])
      const otherSort = await get(fixture.endpoint, { ...query, sort_field: fixture.field === 'problem_desc' ? 'problem_desc' : fixture.field, pageSize: 20 })
      assert.deepEqual(otherSort.list.map(row => Number(row.id)), ids, '其他排序保持原规则')
      for (const invalid of ['0', '-1', '1.5', '1,,2', '1 OR 1=1', '9007199254740992']) await get(fixture.endpoint + '/neighbors', { ...query, id: ids[0], ids: invalid }, 400)
      await get(fixture.endpoint + '/neighbors', { ...query, id: ids[0] }, 401, '')
      await get(fixture.endpoint + '/neighbors', { ...query, id: ids[0] }, 403, otherSession.data.token)
    })
    await t.test('任务子级按所在父子组定位页面，批量和状态筛选保持一致', async () => {
      const insert = async (name, parent = null, updated = '2026-01-01') => Number((await db.prepare('INSERT INTO pms_task(name,parent_task_id,status,source_type,task_type,updated_at)VALUES(?,?,0,3,?,?)').run('focus-group-' + name, parent, archive, updated)).lastInsertRowid)
      const root1 = await insert('A')
      const child1 = await insert('A-child1', root1)
      const child2 = await insert('A-child2', root1)
      const root2 = await insert('B')
      const child3 = await insert('B-child', root2)
      const query = { name: 'focus-group-', sort_field: 'status', sort_order: 'ascend', pageSize: 1 }
      const page2 = await get('/tasks', { ...query, page: 2 })
      assert.deepEqual(page2.list.map(row => Number(row.id)), [root2, child3])
      const position = await get('/tasks/neighbors', { ...query, ids: `${child3},${root2}` })
      assert.equal(Number(position.id), root2)
      assert.equal(Number(position.ordinal), 4)
      assert.equal(Number(position.page), 2)
      const flat = await get('/tasks/neighbors', { ...query, status: '0', ids: `${child3},${root2}` })
      assert.equal(Number(flat.page), 4)
      const child = await get('/tasks/neighbors', { ...query, id: child2 })
      assert.equal(Number(child.page), 1)
      assert.equal(Number(child.prevId), child1)
    })
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    if (created) await db.exec(`DROP SCHEMA ${schema} CASCADE`)
    await db.pool.end()
  }
})
