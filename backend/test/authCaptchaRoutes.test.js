const assert = require('node:assert/strict')
const test = require('node:test')
const express = require('express')
const bcrypt = require('bcryptjs')
const db = require('../src/db')
const captchaModule = require('../src/services/loginCaptchaService')
const sessionModule = require('../src/services/authSessionService')
const accessLog = require('../src/services/accessLogService')

async function fixture(t, { now, beforeCompare } = {}) {
  let answer
  let queries = 0
  const createService = captchaModule.createLoginCaptchaService
  t.mock.method(captchaModule, 'createLoginCaptchaService', () => createService({
    ...(now ? { now } : {}),
    renderImage(text) {
      answer = text
      return captchaModule.renderCaptchaImage(text)
    }
  }))
  const users = [
    { id: 1, employee_no: 'admin', phone: '13800000001', real_name: '管理员', password: bcrypt.hashSync('password123', 4), status: 1, first_login: 1 },
    { id: 2, employee_no: 'other', phone: '13800000002', real_name: '其他用户', password: bcrypt.hashSync('password123', 4), status: 1, first_login: 0 },
    { id: 3, employee_no: 'Admin', phone: '13800000003', real_name: '大小写不同账号', password: bcrypt.hashSync('password123', 4), status: 1, first_login: 0 },
    { id: 4, employee_no: 'disabled', phone: '13800000004', real_name: '停用用户', password: bcrypt.hashSync('password123', 4), status: 0, first_login: 0 },
    { id: 5, employee_no: 'long-password', phone: '13800000005', real_name: '既有长密码用户', password: bcrypt.hashSync('x'.repeat(1025), 4), status: 1, first_login: 0 }
  ]
  t.mock.method(db, 'prepare', () => {
    queries++
    return { get: async account => users.find(user => user.employee_no === account || user.phone === account) }
  })
  t.mock.method(accessLog, 'recordLoginFailure', async () => undefined)
  if (beforeCompare) {
    const compare = bcrypt.compare
    t.mock.method(bcrypt, 'compare', async (...args) => {
      await beforeCompare()
      return compare(...args)
    })
  }
  t.mock.method(sessionModule, 'createAuthSessionService', () => ({
    createSession: async ({ user }) => ({ token: 'session-token', first_login: user.first_login, user: { id: user.id }, menus: [] })
  }))
  delete require.cache[require.resolve('../src/routes/auth')]
  const app = express()
  app.set('trust proxy', 'loopback')
  app.use(express.json())
  app.use('/api/auth', require('../src/routes/auth'))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/auth`
  const login = async (body, ip = '192.0.2.1') => {
    const response = await fetch(`${baseUrl}/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ account: 'admin', password: 'password123', ...body }) })
    return { status: response.status, retryAfter: response.headers.get('retry-after'), body: await response.json() }
  }
  const issue = async (ip = '192.0.2.1') => {
    const response = await fetch(`${baseUrl}/captcha`, { headers: { 'x-forwarded-for': ip } })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('cache-control'), /no-store/)
    const result = await response.json()
    return { data: result.data, params: { captcha_id: result.data.captcha_id, captcha_code: answer } }
  }
  return { login, issue, queries: () => queries, baseUrl }
}

test('直接调用密码登录缺少验证码被拒绝，且不查询账号', async t => {
  const f = await fixture(t)
  const result = await f.login({})
  assert.equal(result.status, 400)
  assert.ok(result.body.fieldErrors.captcha_code)
  assert.equal(f.queries(), 0)
})

test('验证码接口不返回答案，正确验证码登录并保留首次改密策略，重放被拒绝', async t => {
  const f = await fixture(t)
  const { data, params } = await f.issue()
  assert.deepEqual(Object.keys(data).sort(), ['captcha_id', 'expires_in', 'image'])
  const success = await f.login(params)
  assert.equal(success.status, 200)
  assert.equal(success.body.data.first_login, 1)
  const replay = await f.login(params)
  assert.equal(replay.status, 400)
  assert.equal(f.queries(), 1)
})

test('验证码错误或过期时在密码校验之前拒绝，错误后不可再用', async t => {
  let time = 1000
  const f = await fixture(t, { now: () => time })
  const first = await f.issue()
  assert.equal((await f.login({ ...first.params, captcha_code: 'wrong' })).status, 400)
  assert.equal((await f.login(first.params)).status, 400)
  const second = await f.issue()
  time += 120000
  assert.equal((await f.login(second.params)).status, 400)
  assert.equal(f.queries(), 0)
})

test('验证码正确但密码错误不创建会话；验证码不可复用', async t => {
  const f = await fixture(t)
  const { params } = await f.issue()
  assert.equal((await f.login({ ...params, password: 'incorrect' })).status, 401)
  assert.equal((await f.login(params)).status, 400)
  assert.equal(f.queries(), 1)
})

test('验证码输错不锁账号，同IP其他人和本人仍可使用正确验证码登录', async t => {
  const f = await fixture(t)
  for (let i = 0; i < 6; i++) assert.equal((await f.login({})).status, 400)
  assert.equal((await f.login({ ...(await f.issue()).params, account: 'other' })).status, 200)
  assert.equal((await f.login((await f.issue()).params)).status, 200)
})

test('不存在的账号失败5次，只锁该输入，不牵连共享IP的真实用户', async t => {
  const f = await fixture(t)
  for (let i = 0; i < 5; i++) assert.equal((await f.login({ ...(await f.issue()).params, account: '011150' })).status, 401)
  const locked = await f.login({ ...(await f.issue()).params, account: '011150' })
  assert.equal(locked.status, 429)
  assert.ok(Number(locked.retryAfter) > 0)
  assert.equal((await f.login((await f.issue()).params)).status, 200)
})

test('工号和手机按同一账号累计，切换IP不能绕过，其他账号正常登录', async t => {
  const f = await fixture(t)
  for (let i = 0; i < 5; i++) {
    const ip = `192.0.2.${i + 1}`
    assert.equal((await f.login({ ...(await f.issue(ip)).params, account: i % 2 ? '13800000001' : 'admin', password: 'incorrect' }, ip)).status, 401)
  }
  assert.equal((await f.login({ ...(await f.issue()).params, account: '13800000001' })).status, 429)
  assert.equal((await f.login({ ...(await f.issue()).params, account: 'other' })).status, 200)
})

test('失败累计有15分钟滚动窗口，过期的失败不会叠加到新窗口', async t => {
  let time = Date.now()
  t.mock.method(Date, 'now', () => time)
  const f = await fixture(t)
  for (let i = 0; i < 3; i++) assert.equal((await f.login({ ...(await f.issue()).params, password: 'incorrect' })).status, 401)
  time += 15 * 60 * 1000
  for (let i = 0; i < 3; i++) assert.equal((await f.login({ ...(await f.issue()).params, password: 'incorrect' })).status, 401)
  assert.equal((await f.login((await f.issue()).params)).status, 200)
})

test('锁定到期完全清零，一次新失败不会立即再次锁定', async t => {
  let time = Date.now()
  t.mock.method(Date, 'now', () => time)
  const f = await fixture(t)
  for (let i = 0; i < 5; i++) assert.equal((await f.login({ ...(await f.issue()).params, password: 'incorrect' })).status, 401)
  assert.equal((await f.login((await f.issue()).params)).status, 429)
  time += 15 * 60 * 1000
  assert.equal((await f.login({ ...(await f.issue()).params, password: 'incorrect' })).status, 401)
  assert.equal((await f.login((await f.issue()).params)).status, 200)
})

test('其他账号成功不能清除目标账号的失败预算', async t => {
  const f = await fixture(t)
  for (let i = 0; i < 4; i++) assert.equal((await f.login({ ...(await f.issue()).params, password: 'incorrect' })).status, 401)
  assert.equal((await f.login({ ...(await f.issue()).params, account: 'other' })).status, 200)
  assert.equal((await f.login({ ...(await f.issue()).params, password: 'incorrect' })).status, 401)
  assert.equal((await f.login((await f.issue()).params)).status, 429)
})

test('按数据库身份区分大小写账号，不合并两个真实用户', async t => {
  const f = await fixture(t)
  for (let i = 0; i < 5; i++) assert.equal((await f.login({ ...(await f.issue()).params, password: 'incorrect' })).status, 401)
  assert.equal((await f.login({ ...(await f.issue()).params, account: 'Admin' })).status, 200)
})

test('停用账号保持拒绝并受账号频率保护', async t => {
  const f = await fixture(t)
  for (let i = 0; i < 5; i++) assert.equal((await f.login({ ...(await f.issue()).params, account: 'disabled' })).status, 403)
  assert.equal((await f.login({ ...(await f.issue()).params, account: 'disabled' })).status, 429)
  assert.equal((await f.login((await f.issue()).params)).status, 200)
})

test('密码校验异常不会遗留占位，也不被当作密码错误锁号', async t => {
  let errors = 5
  t.mock.method(console, 'error', () => {})
  const f = await fixture(t, { beforeCompare: () => { if (errors-- > 0) throw new Error('comparison unavailable') } })
  for (let i = 0; i < 5; i++) assert.equal((await f.login((await f.issue()).params)).status, 500)
  assert.equal((await f.login((await f.issue()).params)).status, 200)
})

test('畸形和超长参数在查询账号前拒绝，不改变正常账号额度', async t => {
  const f = await fixture(t)
  for (const payload of [{ account: {} }, { account: ['admin'] }, { account: ' ' }, { account: 'a'.repeat(101) }, { password: {} }]) {
    assert.equal((await f.login(payload)).status, 400)
  }
  assert.equal(f.queries(), 0)
  assert.equal((await f.login((await f.issue()).params)).status, 200)
})

test('现有改密规则允许的长密码仍可登录', async t => {
  const f = await fixture(t)
  assert.equal((await f.login({ ...(await f.issue()).params, account: 'long-password', password: 'x'.repeat(1025) })).status, 200)
})

test('并发错误密码不能穿过同账号剩余5次预算', async t => {
  let entered = 0
  let release
  const gate = new Promise(resolve => { release = resolve })
  const f = await fixture(t, { beforeCompare: () => { entered++; return gate } })
  t.after(() => release())
  const params = []
  for (let i = 0; i < 10; i++) params.push((await f.issue()).params)
  const pending = Promise.all(params.map(captcha => f.login({ ...captcha, password: 'incorrect' })))
  const deadline = Date.now() + 2000
  while (entered < 5 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5))
  // 让剩余请求也走到校验边界后再放行，避免只测到串行请求。
  await new Promise(resolve => setTimeout(resolve, 30))
  release()
  const results = await pending
  assert.equal(entered, 5)
  assert.equal(results.filter(result => result.status === 401).length, 5)
  assert.equal(results.filter(result => result.status === 429).length, 5)
})

test('无验证码的高频请求仍被短时节流，正常成功不重置IP请求预算', async t => {
  const f = await fixture(t)
  for (let i = 0; i < 119; i++) assert.equal((await f.login({})).status, 400)
  assert.equal((await f.login((await f.issue()).params)).status, 200)
  const limited = await f.login({})
  assert.equal(limited.status, 429)
  assert.ok(Number(limited.retryAfter) <= 60)
  const ip = '192.0.2.2'
  assert.equal((await f.login((await f.issue(ip)).params, ip)).status, 200)
})

test('验证码获取接口返回429和重试时间且不生成更多图片', async t => {
  const f = await fixture(t)
  for (let i = 0; i < 300; i++) await f.issue()
  const response = await fetch(`${f.baseUrl}/captcha`, { headers: { 'x-forwarded-for': '192.0.2.1' } })
  assert.equal(response.status, 429)
  assert.ok(Number(response.headers.get('retry-after')) > 0)
})
