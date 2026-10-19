const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const enabled = process.env.RUN_DB_INTEGRATION === '1'
const schema = `requirement_overdue_test_${crypto.randomBytes(6).toString('hex')}`
if (enabled) process.env.DB_OPTIONS = `-c search_path=${schema} -c timezone=Asia/Shanghai`

test('真实HTTP：需求完成、重评、暂停、编辑和缓存刷新与完成率一致', { skip: !enabled }, async () => {
  const db = require('../src/db')
  let server
  try {
    assert.ok(['localhost', '127.0.0.1', '::1'].includes(db.pool.options.host))
    await db.exec(`CREATE SCHEMA ${schema}`)
    await db.exec(fs.readFileSync(path.join(__dirname, '../db/init/001_schema.sql'), 'utf8').replace(/^ALTER (DATABASE|ROLE).*$/gm, ''))
    const bcrypt = require('bcryptjs')
    await db.prepare("UPDATE pms_user SET password=?,first_login=0 WHERE employee_no='admin'").run(await bcrypt.hash('vv123456', 4))
    const app = require('../src/app')
    server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    const origin = `http://127.0.0.1:${server.address().port}`
    const login = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account: 'admin', password: 'vv123456' }) })
    const session = await login.json()
    assert.equal(session.code, 0)
    const request = async (endpoint, body, method = 'POST') => {
      const response = await fetch(origin + '/api' + endpoint, { method, headers: { authorization: 'Bearer ' + session.data.token, 'content-type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) })
      const result = await response.json()
      assert.equal(result.code, 0, JSON.stringify(result))
      return result.data
    }
    const product = await request('/products', { name: '逾期规则隔离产品', owner_id: 1 })
    const body = { title: '上会结论需求', requirement_type: 1, product_id: product.id, owner_id: 1, submitter_name: '验收', submit_date: '2026-10-01', expected_end_date: '2026-10-02' }
    const created = await request('/requirements', body)
    const get = () => request('/requirements/' + created.id, undefined, 'GET')
    const change = (status, fields = {}) => request('/requirements/' + created.id + '/status', { status, ...fields }, 'PUT')
    assert.equal((await get()).is_overdue, 1)
    await change(1); await change(2)
    assert.equal((await get()).is_overdue, null)
    await change(30); await change(31)
    assert.equal((await get()).is_overdue, null)
    await request('/requirements/' + created.id, { ...body, title: '结论后编辑需求' }, 'PUT')
    assert.equal((await db.prepare('SELECT is_overdue FROM pms_requirement WHERE id=?').get(created.id)).is_overdue, null)
    await change(35, { pause_date: '2026-10-03', pause_reason: '结论后暂停' })
    assert.equal((await get()).is_overdue, null)
    await change(0)
    assert.equal((await get()).is_overdue, 1)
    await change(35, { pause_date: '2026-10-03', pause_reason: '重新评估后暂停' })
    assert.equal((await get()).is_overdue, 1)
    assert.equal((await db.prepare('SELECT is_overdue FROM pms_requirement WHERE id=?').get(created.id)).is_overdue, 1)
    const direct = await request('/requirements', { ...body, title: '直接实施暂停需求', requirement_type: 4 })
    await request('/requirements/' + direct.id + '/status', { status: 35, pause_date: '2026-10-03', pause_reason: '尚未完成' }, 'PUT')
    assert.equal((await request('/requirements/' + direct.id, undefined, 'GET')).is_overdue, 1)
    await db.prepare('UPDATE pms_requirement SET is_overdue=0 WHERE id=?').run(created.id)
    await require('../src/services/overdueCron').refreshOverdueStatus()
    assert.equal((await db.prepare('SELECT is_overdue FROM pms_requirement WHERE id=?').get(created.id)).is_overdue, 1)
    const { analyzeBusinessData } = require('../src/services/mcpAnalysisService')
    const analyzed = await analyzeBusinessData({ domain: 'requirement', metric: 'overdue_count' })
    assert.equal(analyzed.results[0].value, 2)
    const { decorateQueryResult } = require('../src/mcp/queryTools')
    assert.equal(decorateQueryResult('requirement_get', { overdue_pending: true, is_overdue: null }).is_overdue_label, '待核实')
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    await db.exec(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    await db.pool.end()
  }
})
