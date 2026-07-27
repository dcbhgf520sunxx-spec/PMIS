const assert = require('node:assert/strict')
const test = require('node:test')
const express = require('express')

const { createWecomAuthRouter } = require('../src/routes/wecomAuth')

async function listen(router) {
  const app = express()
  app.use(express.json())
  app.use('/api/auth/wecom', router)
  const server = app.listen(0)
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

function createFixture(overrides = {}) {
  const calls = []
  const callbackErrors = []
  const service = {
    issueOAuthState() {
      return 'state-a'
    },
    validateOAuthState(received, expected) {
      return received === expected
    },
    buildAuthorizationUrl(state) {
      return `https://open.weixin.qq.com/connect/oauth2/authorize?state=${state}`
    },
    async getUserId(code) {
      calls.push(['getUserId', code])
      return 'EMP001'
    },
    issueLoginTicket(userId) {
      calls.push(['issueLoginTicket', userId])
      return 'ticket-a'
    },
    consumeLoginTicket(ticket) {
      calls.push(['consumeLoginTicket', ticket])
      return ticket === 'ticket-a' ? 'EMP001' : null
    },
    ...overrides.service
  }
  const account = {
    id: 8,
    employee_no: 'EMP001',
    real_name: '测试用户',
    phone: '13800000000',
    avatar_url: null,
    status: 1,
    first_login: 1
  }
  const resolveAccount = overrides.resolveAccount || (async (userId) => {
    calls.push(['resolveAccount', userId])
    return account
  })
  const createSession = overrides.createSession || (async (input) => {
    calls.push(['createSession', input.authMethod, input.user.employee_no])
    return {
      token: 'pmis-token',
      first_login: 0,
      access_session_id: 'session-a',
      user: { ...account, roles: ['employee'] },
      menus: [{ id: 1, path: '/home', code: 'home' }]
    }
  })
  return {
    calls,
    router: createWecomAuthRouter({
      service,
      resolveAccount,
      createSession,
      frontendBaseUrl: 'http://gcglsys.znjs.com:9088',
      secureCookies: false,
      onCallbackError: overrides.onCallbackError || ((details) => callbackErrors.push(details))
    }),
    callbackErrors
  }
}

test('工作台入口设置 OAuth state Cookie 后跳转企微静默授权', async (t) => {
  const fixture = createFixture()
  const server = await listen(fixture.router)
  t.after(server.close)

  const response = await fetch(`${server.baseUrl}/api/auth/wecom/start`, { redirect: 'manual' })

  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), 'https://open.weixin.qq.com/connect/oauth2/authorize?state=state-a')
  const cookie = response.headers.get('set-cookie')
  assert.match(cookie, /pmis_wecom_state=state-a/)
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /SameSite=Lax/i)
  assert.match(cookie, /Path=\/api\/auth\/wecom/i)
  assert.doesNotMatch(cookie, /;\s*Secure/i)
})

test('合法企微回调签发一次性票据并跳回正式登录页', async (t) => {
  const fixture = createFixture()
  const server = await listen(fixture.router)
  t.after(server.close)

  const response = await fetch(
    `${server.baseUrl}/api/auth/wecom/callback?code=code-a&state=state-a`,
    {
      redirect: 'manual',
      headers: { cookie: 'pmis_wecom_state=state-a' }
    }
  )

  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), 'http://gcglsys.znjs.com:9088/login?wecom_ticket=ticket-a')
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/)
  assert.deepEqual(fixture.calls, [
    ['getUserId', 'code-a'],
    ['resolveAccount', 'EMP001'],
    ['issueLoginTicket', 'EMP001']
  ])
})

test('OAuth state 不匹配时拒绝身份交换', async (t) => {
  const fixture = createFixture()
  const server = await listen(fixture.router)
  t.after(server.close)

  const response = await fetch(
    `${server.baseUrl}/api/auth/wecom/callback?code=code-a&state=state-b`,
    {
      redirect: 'manual',
      headers: { cookie: 'pmis_wecom_state=state-a' }
    }
  )

  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), 'http://gcglsys.znjs.com:9088/login?wecom_error=invalid_state')
  assert.deepEqual(fixture.calls, [])
})

test('企微接口回调失败时只记录安全错误标识', async (t) => {
  const upstreamError = new Error('sensitive upstream detail')
  upstreamError.errcode = 60020
  const fixture = createFixture({
    service: {
      async getUserId() {
        throw upstreamError
      }
    }
  })
  const server = await listen(fixture.router)
  t.after(server.close)

  const response = await fetch(
    `${server.baseUrl}/api/auth/wecom/callback?code=secret-code&state=state-a`,
    {
      redirect: 'manual',
      headers: { cookie: 'pmis_wecom_state=state-a' }
    }
  )

  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), 'http://gcglsys.znjs.com:9088/login?wecom_error=login_failed')
  assert.deepEqual(fixture.callbackErrors, [{
    code: null,
    errcode: 60020,
    name: 'Error'
  }])
  assert.doesNotMatch(JSON.stringify(fixture.callbackErrors), /secret-code|sensitive upstream detail/)
})

test('一次性票据兑换为现有 PMIS 会话并明确跳过首次改密', async (t) => {
  const fixture = createFixture()
  const server = await listen(fixture.router)
  t.after(server.close)

  const response = await fetch(`${server.baseUrl}/api/auth/wecom/exchange`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ticket: 'ticket-a' })
  })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.code, 0)
  assert.equal(body.data.token, 'pmis-token')
  assert.equal(body.data.first_login, 0)
  assert.deepEqual(fixture.calls, [
    ['consumeLoginTicket', 'ticket-a'],
    ['resolveAccount', 'EMP001'],
    ['createSession', 'wecom', 'EMP001']
  ])
})

test('无效或已消费的登录票据不能换取 PMIS 会话', async (t) => {
  const fixture = createFixture()
  const server = await listen(fixture.router)
  t.after(server.close)

  const response = await fetch(`${server.baseUrl}/api/auth/wecom/exchange`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ticket: 'invalid-ticket' })
  })
  const body = await response.json()

  assert.equal(response.status, 401)
  assert.equal(body.code, 401)
  assert.match(body.message, /已失效/)
})
