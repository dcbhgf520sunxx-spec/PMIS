const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const enabled = process.env.RUN_DB_INTEGRATION === '1'
const schema = `sorting_test_${crypto.randomBytes(6).toString('hex')}`
if (enabled) process.env.DB_OPTIONS = `-c search_path=${schema} -c timezone=Asia/Shanghai`

test('真实HTTP/PostgreSQL：任务、跟进人、权限范围按展示内容排序并保持分页与邻居一致', { skip: !enabled }, async t => {
  const db = require('../src/db')
  let server
  let schemaCreated = false
  try {
    assert.equal(process.env.INTEGRATION_DB_ISOLATED, '1', '排序集成测试必须连接隔离测试数据库')
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
    const get = async (endpoint, query = {}) => {
      const response = await fetch(origin + '/api' + endpoint + '?' + new URLSearchParams(query), { headers: { authorization: 'Bearer ' + session.data.token } })
      const result = await response.json()
      assert.equal(result.code, 0, endpoint + ': ' + JSON.stringify(result))
      return result.data
    }
    const users = []
    for (const [code, name] of [['sort_z', 'Zulu'], ['sort_a', 'Alpha']]) {
      const result = await db.prepare('INSERT INTO pms_user(employee_no,real_name,phone,password,status,first_login)VALUES(?,?,?,?,1,0)').run(code, name, `1390000000${users.length}`, password)
      users.push(Number(result.lastInsertRowid))
    }
    const archive = await db.prepare('SELECT id FROM pms_archive WHERE is_deleted=0 ORDER BY id LIMIT 1').get()
    const tasks = []
    for (const [index, creator] of users.entries()) {
      const task = await db.prepare('INSERT INTO pms_task(name,source_type,task_type,creator_id,updater_id,created_at)VALUES(?,3,?,?,1,?)').run(`sorting-task-${index}`, archive.id, creator, `2026-0${index + 1}-01`)
      tasks.push(Number(task.lastInsertRowid))
    }
    const child = await db.prepare('INSERT INTO pms_task(name,parent_task_id,source_type,task_type,creator_id,updater_id)VALUES(?,?,3,?,?,1)').run('sorting-task-child', tasks[1], archive.id, users[1])
    const childId = Number(child.lastInsertRowid)
    await t.test('任务状态优先、同状态最近更新优先，定位页按父子组而非行数计算', async () => {
      const records = []
      for (const [index, status, parentIndex, updated] of [
        [0, 0, null, '2026-01-01'], [1, 0, 0, '2026-01-01'],
        [2, 0, 0, '2026-01-01'], [3, 1, null, '2026-01-02'],
        [4, 1, null, '2026-01-03'], [5, 0, null, '2026-01-01']
      ]) {
        const result = await db.prepare('INSERT INTO pms_task(name,status,parent_task_id,source_type,task_type,creator_id,updated_at)VALUES(?,?,?,3,?,1,?)')
          .run(`recent-status-${index}`, status, parentIndex === null ? null : records[parentIndex], archive.id, updated)
        records.push(Number(result.lastInsertRowid))
      }
      const query = { name: 'recent-status-', sort_field: 'status', sort_order: 'ascend', pageSize: 2 }
      const page2 = await get('/tasks', { ...query, page: 2 })
      assert.deepEqual(page2.list.map(row => Number(row.id)), [records[4], records[3]])
      const position = await get('/tasks/neighbors', { ...query, id: records[4] })
      assert.equal(Number(position.ordinal), 5)
      assert.equal(Number(position.page), 2)
      const changed = await (await fetch(origin + `/api/tasks/${records[5]}/status`, {
        method: 'PUT', headers: { authorization: 'Bearer ' + session.data.token, 'content-type': 'application/json' }, body: JSON.stringify({ status: 1 })
      })).json()
      assert.equal(changed.code, 0)
      const after = await get('/tasks', { ...query, page: 1 })
      assert.deepEqual(after.list.map(row => Number(row.id)), [...records.slice(0, 3), records[5]])
      const target = await get('/tasks/neighbors', { ...query, id: records[5] })
      assert.equal(Number(target.page), 1)
      assert.equal(Number(target.prevId), records[2])
      assert.equal(Number(target.nextId), records[4])
      const filtered = await get('/tasks', { ...query, status: '1' })
      assert.deepEqual(filtered.list.map(row => Number(row.id)), [records[5], records[4]])
      assert.equal(Number((await get('/tasks/neighbors', { ...query, status: '1', id: records[3] })).page), 2)
      assert.equal((await get('/tasks/neighbors', { ...query, status: '0', id: records[5] })).page, undefined)
      const descending = await get('/tasks', { ...query, sort_order: 'descend' })
      assert.deepEqual(descending.list.map(row => Number(row.id)), [records[5], records[4]])
      // 子任务更新只改变所在组的位置，保留主任务在子任务前的顺序。
      await db.prepare('UPDATE pms_task SET updated_at=NOW() WHERE id=?').run(records[2])
      const firstGroup = await get('/tasks', { ...query, pageSize: 1 })
      assert.deepEqual(firstGroup.list.map(row => Number(row.id)), [records[0], records[2], records[1]])
      assert.equal(Number((await get('/tasks/neighbors', { ...query, pageSize: 1, id: records[2] })).page), 1)
    })
    const product = await db.prepare('INSERT INTO pms_product(name,owner_id,creator_id,updater_id)VALUES(?,1,1,1)').run('sorting-product')
    const workOrders = []
    for (const [index, follower] of users.entries()) {
      const result = await db.prepare('INSERT INTO pms_work_order(product_id,problem_type,problem_desc,follower_id,submitter_name,submitter_dept,submit_time,creator_id,updater_id)VALUES(?,?,?,?,?,?,NOW(),1,1)').run(product.lastInsertRowid, archive.id, `sorting-work-${index}`, follower, '排序验收', '隔离环境')
      workOrders.push(Number(result.lastInsertRowid))
    }
    for (const order of ['ascend', 'descend']) {
      await t.test(`任务创建人${order}、分页和父子组及邻居`, async () => {
        const query = { name: 'sorting-task-', sort_field: 'creatorName', sort_order: order, pageSize: 1 }
        const first = await get('/tasks', { ...query, page: 1 })
        const second = await get('/tasks', { ...query, page: 2 })
        const expected = order === 'ascend' ? [tasks[1], childId, tasks[0]] : [tasks[0], tasks[1], childId]
        const visible = [...first.list, ...second.list].map(row => Number(row.id))
        assert.deepEqual(visible, expected)
        assert.equal(first.total, 2)
        const neighbors = await get('/tasks/neighbors', { ...query, id: expected[1] })
        assert.equal(Number(neighbors.prevId), expected[0])
        assert.equal(Number(neighbors.nextId), expected[2])
      })
      await t.test(`工单跟进人${order}、分页和邻居`, async () => {
        const query = { problem_desc: 'sorting-work-', sort_field: 'follower_id', sort_order: order, pageSize: 1 }
        const first = await get('/work-orders', { ...query, page: 1 })
        const second = await get('/work-orders', { ...query, page: 2 })
        const expected = order === 'ascend' ? workOrders.slice().reverse() : workOrders
        assert.deepEqual([...first.list, ...second.list].map(row => Number(row.id)), expected)
        const neighbors = await get('/work-orders/neighbors', { ...query, id: expected[0] })
        assert.equal(Number(neighbors.nextId), expected[1])
      })
    }
    const roles = []
    for (const [index, parentName, leafName] of [[0, 'Zulu-parent', 'Alpha-leaf'], [1, 'Alpha-parent', 'Zulu-leaf']]) {
      const role = await db.prepare('INSERT INTO pms_role(code,name)VALUES(?,?)').run(`sorting-role-${index}`, `sorting-role-${index}`)
      const parent = await db.prepare('INSERT INTO pms_menu(name,code,sort_order)VALUES(?,?,?)').run(parentName, `sorting-parent-${index}`, index * 2)
      const leaf = await db.prepare('INSERT INTO pms_menu(parent_id,name,code,sort_order)VALUES(?,?,?,?)').run(parent.lastInsertRowid, leafName, `sorting-leaf-${index}`, index * 2 + 1)
      for (const menu of [parent.lastInsertRowid, leaf.lastInsertRowid]) await db.prepare('INSERT INTO pms_role_menu(role_id,menu_id)VALUES(?,?)').run(role.lastInsertRowid, menu)
      roles.push(Number(role.lastInsertRowid))
    }
    await t.test('角色权限范围只按实际展示的有效叶子名称排序', async () => {
      for (const order of ['ascend', 'descend']) {
        const query = { name: 'sorting-role-', sort_field: 'permissions', sort_order: order, pageSize: 1 }
        const first = await get('/roles', { ...query, page: 1 })
        const second = await get('/roles', { ...query, page: 2 })
        const rows = [...first.list, ...second.list]
        assert.deepEqual(rows.map(row => Number(row.id)), order === 'ascend' ? roles : roles.slice().reverse())
        assert.deepEqual(rows.map(row => row.permissions), order === 'ascend' ? ['Alpha-leaf', 'Zulu-leaf'] : ['Zulu-leaf', 'Alpha-leaf'])
      }
    })
    await t.test('角色详情与列表使用同一权限范围，详情和编辑入口正常读取', async () => {
      for (const [index, id] of roles.entries()) {
        const detail = await get(`/roles/${id}`)
        assert.equal(detail.permissions, index === 0 ? 'Alpha-leaf' : 'Zulu-leaf')
      }
    })
    await t.test('空权限和已删除子菜单仍按实际可见文本排序', async () => {
      const empty = await db.prepare('INSERT INTO pms_role(code,name)VALUES(?,?)').run('sorting-empty', 'sorting-edge-empty')
      const solo = await db.prepare('INSERT INTO pms_role(code,name)VALUES(?,?)').run('sorting-solo', 'sorting-edge-solo')
      const parent = await db.prepare('INSERT INTO pms_menu(name,code)VALUES(?,?)').run('Solo', 'sorting-solo-parent')
      const deleted = await db.prepare('INSERT INTO pms_menu(parent_id,name,code,is_deleted)VALUES(?,?,?,1)').run(parent.lastInsertRowid, 'Hidden', 'sorting-deleted-child')
      for (const menu of [parent.lastInsertRowid, deleted.lastInsertRowid]) await db.prepare('INSERT INTO pms_role_menu(role_id,menu_id)VALUES(?,?)').run(solo.lastInsertRowid, menu)
      const result = await get('/roles', { name: 'sorting-edge-', sort_field: 'permissions', sort_order: 'ascend' })
      assert.deepEqual(result.list.map(row => Number(row.id)), [Number(empty.lastInsertRowid), Number(solo.lastInsertRowid)])
      assert.deepEqual(result.list.map(row => row.permissions), ['-', 'Solo'])
      assert.equal((await get(`/roles/${solo.lastInsertRowid}`)).permissions, 'Solo')
    })
    if (process.env.SORTING_BROWSER_SCRIPT) await require(process.env.SORTING_BROWSER_SCRIPT)({ session: session.data, origin })
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    if (schemaCreated) await db.exec(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    await db.pool.end()
  }
})
