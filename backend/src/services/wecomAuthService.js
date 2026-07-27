const crypto = require('crypto')

const LOGIN_TICKET_TTL_MS = 60_000
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60_000

function requireConfig(env, name) {
  const value = String(env[name] || '').trim()
  if (!value) throw new Error(`未配置 ${name}`)
  return value
}

function createWecomAuthService({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  randomBytes = crypto.randomBytes
} = {}) {
  const corpId = requireConfig(env, 'WECOM_CORP_ID')
  const agentId = requireConfig(env, 'WECOM_AGENT_ID')
  const secret = requireConfig(env, 'WECOM_SECRET')
  const callbackUrl = requireConfig(env, 'WECOM_CALLBACK_URL')
  const loginTickets = new Map()
  let accessTokenCache = null

  function buildAuthorizationUrl(state) {
    const url = new URL('https://open.weixin.qq.com/connect/oauth2/authorize')
    url.searchParams.set('appid', corpId)
    url.searchParams.set('redirect_uri', callbackUrl)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'snsapi_base')
    url.searchParams.set('agentid', agentId)
    url.searchParams.set('state', state)
    url.hash = 'wechat_redirect'
    return url.toString()
  }

  async function readWecomResponse(response, fallbackMessage) {
    const body = await response.json()
    if (!response.ok || Number(body.errcode || 0) !== 0) {
      const error = new Error(body.errmsg || fallbackMessage)
      error.errcode = Number(body.errcode || response.status)
      throw error
    }
    return body
  }

  async function getAccessToken() {
    if (accessTokenCache && accessTokenCache.expiresAt > now() + ACCESS_TOKEN_REFRESH_MARGIN_MS) {
      return accessTokenCache.value
    }

    const url = new URL('https://qyapi.weixin.qq.com/cgi-bin/gettoken')
    url.searchParams.set('corpid', corpId)
    url.searchParams.set('corpsecret', secret)
    const response = await fetchImpl(url)
    const body = await readWecomResponse(response, '获取企微访问凭证失败')
    if (!body.access_token) throw new Error('企微未返回 access_token')

    accessTokenCache = {
      value: body.access_token,
      expiresAt: now() + Number(body.expires_in || 7200) * 1000
    }
    return accessTokenCache.value
  }

  async function fetchUserIdentity(code) {
    const accessToken = await getAccessToken()
    const url = new URL('https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo')
    url.searchParams.set('access_token', accessToken)
    url.searchParams.set('code', code)
    const response = await fetchImpl(url)
    return readWecomResponse(response, '获取企微用户身份失败')
  }

  async function getUserId(code) {
    if (!String(code || '').trim()) throw new Error('企微授权 code 不能为空')
    let body
    try {
      body = await fetchUserIdentity(code)
    } catch (error) {
      if (![40014, 42001].includes(error.errcode)) throw error
      accessTokenCache = null
      body = await fetchUserIdentity(code)
    }
    if (!body.userid) throw new Error('企微未返回成员 UserId')
    return body.userid
  }

  function issueOAuthState() {
    return randomBytes(32).toString('base64url')
  }

  function validateOAuthState(receivedState, expectedState) {
    const received = Buffer.from(String(receivedState || ''))
    const expected = Buffer.from(String(expectedState || ''))
    if (!received.length || received.length !== expected.length) return false
    return crypto.timingSafeEqual(received, expected)
  }

  function issueLoginTicket(userId) {
    const ticket = randomBytes(32).toString('base64url')
    loginTickets.set(ticket, {
      userId,
      expiresAt: now() + LOGIN_TICKET_TTL_MS
    })
    return ticket
  }

  function consumeLoginTicket(ticket) {
    const record = loginTickets.get(ticket)
    if (!record) return null
    loginTickets.delete(ticket)
    if (record.expiresAt <= now()) return null
    return record.userId
  }

  return {
    buildAuthorizationUrl,
    consumeLoginTicket,
    getUserId,
    issueLoginTicket,
    issueOAuthState,
    validateOAuthState
  }
}

module.exports = { createWecomAuthService }
