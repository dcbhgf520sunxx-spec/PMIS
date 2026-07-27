const crypto = require('crypto')

const LOGIN_TICKET_TTL_MS = 60_000

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
  const userIdUrl = requireConfig(env, 'WECOM_USER_ID_URL')
  const callbackUrl = requireConfig(env, 'WECOM_CALLBACK_URL')
  const loginTickets = new Map()

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

  async function getUserId(code) {
    if (!String(code || '').trim()) throw new Error('企微授权 code 不能为空')
    const url = new URL(userIdUrl)
    url.searchParams.set('code', code)
    const response = await fetchImpl(url)
    const body = await response.json()
    if (!response.ok || Number(body.code) !== 100) {
      const error = new Error('公司内部企微身份转换失败')
      error.errcode = Number(body.code || response.status)
      throw error
    }
    const userId = String(body.data || '').trim()
    if (!userId) throw new Error('公司内部企微身份转换未返回 UserId')
    return userId
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
