const assert = require('node:assert/strict')
const test = require('node:test')

const enabled = process.env.RUN_DB_INTEGRATION === '1'
const DEFAULT_ADMIN_HASH = '$2b$10$sJ8gCvuCgJQbcihvZEIWheUQEq1oIyVVh3EZa8fSlpOy80ihQ5UPi'

async function readJson(response) {
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

test('真实 HTTP、PostgreSQL 和核心业务流程', { skip: !enabled }, async (t) => {
  assert.equal(process.env.INTEGRATION_DB_ISOLATED, '1', '真实集成测试只能连接明确标记的隔离数据库')

  const app = require('../src/app')
  const db = require('../src/db')
  const server = app.listen(0)
  let token = ''

  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const { port } = server.address()
  const baseUrl = `http://127.0.0.1:${port}`
  const request = async (path, { method = 'GET', body, auth = true } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(auth && token ? { authorization: `Bearer ${token}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    return { response, body: await readJson(response) }
  }

  try {
    await t.test('健康检查连接真实 PostgreSQL', async () => {
      const result = await request('/api/health', { auth: false })
      assert.equal(result.response.status, 200)
      assert.equal(result.body.data.db, 'connected')
    })

    await t.test('首次登录只能改密，改密日志不含明文', async () => {
      const login = await request('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: { account: 'admin', password: 'vv123456' }
      })
      assert.equal(login.response.status, 200)
      assert.equal(login.body.data.first_login, 1)
      token = login.body.data.token

      const blocked = await request('/api/users')
      assert.equal(blocked.response.status, 403)

      const password = await request('/api/auth/password', {
        method: 'PUT',
        body: { old_password: 'vv123456', new_password: 'vv1234567' }
      })
      assert.equal(password.response.status, 200)

      const allowed = await request('/api/users')
      assert.equal(allowed.response.status, 200)

      const passwordLog = await db.prepare(
        "SELECT old_value, new_value FROM pms_op_log WHERE module = '用户' AND action = '更改密码' ORDER BY id DESC LIMIT 1"
      ).get()
      assert.deepEqual(passwordLog, { old_value: '***', new_value: '***' })
    })

    await t.test('修改手机号必须验证当前密码', async () => {
      const rejected = await request('/api/auth/me/phone', {
        method: 'PUT',
        body: { phone: '13900000000', password: 'wrong-password' }
      })
      assert.equal(rejected.response.status, 401)

      const changed = await request('/api/auth/me/phone', {
        method: 'PUT',
        body: { phone: '13900000000', password: 'vv1234567' }
      })
      assert.equal(changed.response.status, 200)
      assert.equal(changed.body.data.phone, '13900000000')
    })

    let testUserId
    let roleIds
    await t.test('多角色筛选只返回一行用户，越界页保留真实总数', async () => {
      const suffix = Date.now().toString(36)
      const createdRoles = []
      for (const index of [1, 2]) {
        const role = await request('/api/roles', {
          method: 'POST',
          body: { code: `f19_${suffix}_${index}`, name: `F19测试角色${index}` }
        })
        assert.equal(role.response.status, 200)
        createdRoles.push(role.body.data.id)
      }
      roleIds = createdRoles

      const user = await request('/api/users', {
        method: 'POST',
        body: {
          employee_no: `f19_${suffix}`,
          real_name: 'F19集成测试用户',
          phone: `137${String(Date.now()).slice(-8)}`,
          password: 'test123',
          status: 1,
          role_ids: roleIds
        }
      })
      assert.equal(user.response.status, 200)
      testUserId = user.body.data.id

      const filtered = await request(`/api/users?role_ids=${roleIds.join(',')}&page=1&pageSize=10`)
      assert.equal(filtered.response.status, 200)
      assert.equal(filtered.body.data.total, 1)
      assert.equal(filtered.body.data.list.length, 1)
      assert.equal(filtered.body.data.list[0].id, testUserId)
      assert.equal(filtered.body.data.list[0].roles.length, 2)

      const outOfRange = await request('/api/users?page=999&pageSize=10')
      assert.equal(outOfRange.response.status, 200)
      assert.equal(outOfRange.body.data.list.length, 0)
      assert.ok(outOfRange.body.data.total >= 2)
    })

    await t.test('工单严格顺序流转并保护被引用档案', async () => {
      const productResult = await db.prepare(
        'INSERT INTO pms_product (name, owner_id, status, creator_id, updater_id) VALUES (?, ?, 1, 1, 1)'
      ).run(`F19测试产品${Date.now()}`, testUserId)
      const product = { id: productResult.lastInsertRowid }
      const problemType = await db.prepare("SELECT a.id FROM pms_archive a JOIN pms_archive_type t ON t.id = a.archive_type_id WHERE t.code_prefix = 'PT' AND a.status = 1 AND a.is_deleted = 0 ORDER BY a.id LIMIT 1").get()
      const neighborMarker = `F19相邻查询${Date.now()}`
      const uniqueText = `<p>${neighborMarker} A</p><script>alert(1)</script><strong>保留</strong>`
      const created = await request('/api/work-orders', {
        method: 'POST',
        body: {
          product_id: product.id,
          problem_type: problemType.id,
          problem_desc: uniqueText,
          follower_id: testUserId,
          urgency: 1,
          status: 0,
          expected_resolve_date: '2026-07-30',
          submitter_name: '测试人',
          submitter_dept: '测试部门',
          submit_time: '2026-07-16'
        }
      })
      assert.equal(created.response.status, 200)
      const workOrderId = created.body.data.id

      const detail = await request(`/api/work-orders/${workOrderId}`)
      assert.equal(detail.response.status, 200)
      assert.doesNotMatch(detail.body.data.problem_desc, /<script/i)
      assert.match(detail.body.data.problem_desc, /<strong>保留<\/strong>/)

      const neighborIds = [workOrderId]
      for (const suffix of ['B', 'C']) {
        const neighborOrder = await request('/api/work-orders', {
          method: 'POST',
          body: {
            product_id: product.id,
            problem_type: problemType.id,
            problem_desc: `<p>${neighborMarker} ${suffix}</p>`,
            follower_id: testUserId,
            urgency: 1,
            status: 0,
            expected_resolve_date: '2026-07-30',
            submitter_name: '测试人',
            submitter_dept: '测试部门',
            submit_time: '2026-07-16'
          }
        })
        assert.equal(neighborOrder.response.status, 200)
        neighborIds.push(neighborOrder.body.data.id)
      }
      const neighbors = await request(
        `/api/work-orders/neighbors?id=${neighborIds[1]}&problem_desc=${encodeURIComponent(neighborMarker)}&sort_field=created_at&sort_order=descend`
      )
      assert.equal(neighbors.response.status, 200)
      assert.deepEqual(neighbors.body.data, {
        prevId: neighborIds[2],
        nextId: neighborIds[0],
        total: 3,
        ordinal: 2
      })

      const skipToResolved = await request(`/api/work-orders/${workOrderId}/status`, {
        method: 'PUT', body: { status: 2, resolve_date: '2026-07-16', result_desc: '处理完成' }
      })
      assert.equal(skipToResolved.response.status, 400)

      const processing = await request(`/api/work-orders/${workOrderId}/status`, {
        method: 'PUT', body: { status: 1 }
      })
      assert.equal(processing.response.status, 200)

      const skipToClosed = await request(`/api/work-orders/${workOrderId}/status`, {
        method: 'PUT', body: { status: 3, close_date: '2026-07-16' }
      })
      assert.equal(skipToClosed.response.status, 400)

      const missingResolvedFields = await request(`/api/work-orders/${workOrderId}/status`, {
        method: 'PUT', body: { status: 2 }
      })
      assert.equal(missingResolvedFields.response.status, 400)

      const resolved = await request(`/api/work-orders/${workOrderId}/status`, {
        method: 'PUT', body: { status: 2, resolve_date: '2026-07-16', result_desc: '<p>已解决</p><img src=x onerror=alert(1)>' }
      })
      assert.equal(resolved.response.status, 200)

      const missingCloseDate = await request(`/api/work-orders/${workOrderId}/status`, {
        method: 'PUT', body: { status: 3 }
      })
      assert.equal(missingCloseDate.response.status, 400)

      const closed = await request(`/api/work-orders/${workOrderId}/status`, {
        method: 'PUT', body: { status: 3, close_date: '2026-07-17' }
      })
      assert.equal(closed.response.status, 200)

      const missingSuspendDate = await request(`/api/work-orders/${workOrderId}/status`, {
        method: 'PUT', body: { status: 4 }
      })
      assert.equal(missingSuspendDate.response.status, 400)

      const paused = await request(`/api/work-orders/${workOrderId}/status`, {
        method: 'PUT', body: { status: 4, suspend_date: '2026-07-18' }
      })
      assert.equal(paused.response.status, 200)

      const pausedDetail = await request(`/api/work-orders/${workOrderId}`)
      assert.equal(pausedDetail.body.data.status, 4)
      assert.equal(String(pausedDetail.body.data.suspend_date).slice(0, 10), '2026-07-18')
      assert.equal(String(pausedDetail.body.data.resolve_date).slice(0, 10), '2026-07-16')
      assert.equal(String(pausedDetail.body.data.close_date).slice(0, 10), '2026-07-17')
      assert.match(pausedDetail.body.data.result_desc, /已解决/)

      const resumed = await request(`/api/work-orders/${workOrderId}/status`, {
        method: 'PUT', body: { status: 1 }
      })
      assert.equal(resumed.response.status, 200)

      const resumedDetail = await request(`/api/work-orders/${workOrderId}`)
      assert.equal(resumedDetail.body.data.status, 1)
      assert.equal(resumedDetail.body.data.suspend_date, null)
      assert.equal(resumedDetail.body.data.resolve_date, null)
      assert.equal(resumedDetail.body.data.close_date, null)
      assert.equal(resumedDetail.body.data.result_desc, null)

      const archiveDelete = await request(`/api/archives/${system.id}`, { method: 'DELETE' })
      assert.equal(archiveDelete.response.status, 400)
      assert.match(archiveDelete.body.message, /引用/)
    })

    await t.test('头像允许 5 MB 并拒绝超过 5 MB', async () => {
      const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47])
      const allowedBuffer = Buffer.alloc(5 * 1024 * 1024)
      signature.copy(allowedBuffer)
      const uploaded = await request('/api/auth/me/avatar', {
        method: 'POST',
        body: { fileName: 'allowed.png', mimeType: 'image/png', contentBase64: allowedBuffer.toString('base64') }
      })
      assert.equal(uploaded.response.status, 200)
      assert.match(uploaded.body.data.avatar_url, /^\/uploads\/avatars\//)

      const reset = await request('/api/auth/me/avatar', { method: 'DELETE' })
      assert.equal(reset.response.status, 200)

      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1)
      signature.copy(oversizedBuffer)
      const rejected = await request('/api/auth/me/avatar', {
        method: 'POST',
        body: { fileName: 'oversized.png', mimeType: 'image/png', contentBase64: oversizedBuffer.toString('base64') }
      })
      assert.equal(rejected.response.status, 400)
      assert.match(rejected.body.message, /5MB/)
    })
  } finally {
    await db.prepare(
      'UPDATE pms_user SET phone = ?, password = ?, first_login = 1, avatar_url = NULL, updated_at = NOW() WHERE id = 1'
    ).run('13800000000', DEFAULT_ADMIN_HASH)
    await new Promise((resolve) => server.close(resolve))
    await db.pool.end()
  }
})
