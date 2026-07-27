const assert = require('node:assert/strict')
const test = require('node:test')

const { createWecomAuthService } = require('../src/services/wecomAuthService')
const { resolveWecomAccount } = require('../src/services/wecomAccountService')

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body
    }
  }
}

function createEnv() {
  return {
    WECOM_CORP_ID: 'ww-test-corp',
    WECOM_AGENT_ID: '1000001',
    WECOM_SECRET: 'server-only-secret',
    WECOM_CALLBACK_URL: 'http://gcglsys.znjs.com:9088/api/auth/wecom/callback'
  }
}

test('企微授权地址使用静默授权并绑定应用和回调地址', () => {
  const service = createWecomAuthService({
    env: createEnv(),
    randomBytes: () => Buffer.alloc(32, 7)
  })

  const url = new URL(service.buildAuthorizationUrl('state-value'))

  assert.equal(url.origin, 'https://open.weixin.qq.com')
  assert.equal(url.pathname, '/connect/oauth2/authorize')
  assert.equal(url.searchParams.get('appid'), 'ww-test-corp')
  assert.equal(url.searchParams.get('redirect_uri'), 'http://gcglsys.znjs.com:9088/api/auth/wecom/callback')
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('scope'), 'snsapi_base')
  assert.equal(url.searchParams.get('agentid'), '1000001')
  assert.equal(url.searchParams.get('state'), 'state-value')
  assert.equal(url.hash, '#wechat_redirect')
})

test('企微配置缺失时不生成不完整的授权地址', () => {
  const env = createEnv()
  delete env.WECOM_SECRET

  assert.throws(
    () => createWecomAuthService({ env }),
    /WECOM_SECRET/
  )
})

test('企微身份交换只在后端获取并缓存应用 access_token', async () => {
  const requests = []
  const fetchImpl = async (url) => {
    requests.push(String(url))
    if (String(url).includes('/cgi-bin/gettoken')) {
      return jsonResponse({ errcode: 0, errmsg: 'ok', access_token: 'token-a', expires_in: 7200 })
    }
    const requestUrl = new URL(url)
    return jsonResponse({
      errcode: 0,
      errmsg: 'ok',
      userid: requestUrl.searchParams.get('code') === 'code-a' ? 'EMP001' : 'EMP002',
      deviceid: 'device-id'
    })
  }
  const service = createWecomAuthService({
    env: createEnv(),
    fetchImpl,
    now: () => 1_000_000
  })

  assert.equal(await service.getUserId('code-a'), 'EMP001')
  assert.equal(await service.getUserId('code-b'), 'EMP002')
  assert.equal(requests.filter((url) => url.includes('/cgi-bin/gettoken')).length, 1)
  assert.equal(requests.filter((url) => url.includes('/cgi-bin/auth/getuserinfo')).length, 2)
  assert.ok(requests.every((url) => !url.includes('server-only-secret') || url.includes('/cgi-bin/gettoken')))
})

test('企微提前判定 access_token 失效时只刷新一次后重试身份交换', async () => {
  let tokenRequests = 0
  let identityRequests = 0
  const fetchImpl = async (url) => {
    if (String(url).includes('/cgi-bin/gettoken')) {
      tokenRequests += 1
      return jsonResponse({
        errcode: 0,
        errmsg: 'ok',
        access_token: tokenRequests === 1 ? 'expired-token' : 'fresh-token',
        expires_in: 7200
      })
    }
    identityRequests += 1
    const accessToken = new URL(url).searchParams.get('access_token')
    if (accessToken === 'expired-token') {
      return jsonResponse({ errcode: 40014, errmsg: 'invalid access_token' })
    }
    return jsonResponse({ errcode: 0, errmsg: 'ok', userid: 'EMP001', deviceid: 'device-id' })
  }
  const service = createWecomAuthService({
    env: createEnv(),
    fetchImpl,
    now: () => 1_000_000
  })

  assert.equal(await service.getUserId('code-a'), 'EMP001')
  assert.equal(tokenRequests, 2)
  assert.equal(identityRequests, 2)
})

test('一次性登录票据兑换后立即失效且过期票据不能使用', () => {
  let currentTime = 1_000_000
  let seed = 1
  const service = createWecomAuthService({
    env: createEnv(),
    now: () => currentTime,
    randomBytes: (size) => Buffer.alloc(size, seed++)
  })

  const firstTicket = service.issueLoginTicket('EMP001')
  assert.equal(service.consumeLoginTicket(firstTicket), 'EMP001')
  assert.equal(service.consumeLoginTicket(firstTicket), null)

  const expiredTicket = service.issueLoginTicket('EMP002')
  currentTime += 61_000
  assert.equal(service.consumeLoginTicket(expiredTicket), null)
})

test('OAuth state 使用随机值并只接受同一浏览器回传值', () => {
  const service = createWecomAuthService({
    env: createEnv(),
    randomBytes: () => Buffer.alloc(32, 9)
  })

  const state = service.issueOAuthState()

  assert.equal(state, Buffer.alloc(32, 9).toString('base64url'))
  assert.equal(service.validateOAuthState(state, state), true)
  assert.equal(service.validateOAuthState('other-state', state), false)
  assert.equal(service.validateOAuthState('', state), false)
})

test('企微 UserId 必须精确匹配启用的 PMIS 工号', async () => {
  const enabledUser = {
    id: 8,
    employee_no: 'EMP001',
    real_name: '测试用户',
    phone: '13800000000',
    avatar_url: null,
    status: 1,
    first_login: 1
  }
  const db = {
    prepare() {
      return {
        async get(employeeNo) {
          return employeeNo === 'EMP001' ? enabledUser : undefined
        }
      }
    }
  }

  assert.deepEqual(await resolveWecomAccount('EMP001', db), enabledUser)
  await assert.rejects(
    resolveWecomAccount('emp001', db),
    (error) => error.code === 'WECOM_ACCOUNT_NOT_FOUND'
  )
})

test('企微单点拒绝停用的 PMIS 账号', async () => {
  const db = {
    prepare() {
      return {
        async get() {
          return {
            id: 9,
            employee_no: 'EMP002',
            real_name: '停用用户',
            phone: '13900000000',
            avatar_url: null,
            status: 0,
            first_login: 0
          }
        }
      }
    }
  }

  await assert.rejects(
    resolveWecomAccount('EMP002', db),
    (error) => error.code === 'WECOM_ACCOUNT_DISABLED'
  )
})
