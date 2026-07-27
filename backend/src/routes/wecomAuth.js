const express = require('express')
const { createWecomAuthService } = require('../services/wecomAuthService')
const { resolveWecomAccount } = require('../services/wecomAccountService')
const { createAuthSessionService } = require('../services/authSessionService')

const STATE_COOKIE_NAME = 'pmis_wecom_state'
const STATE_MAX_AGE_SECONDS = 300

function parseCookies(header = '') {
  return String(header)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((result, part) => {
      const separator = part.indexOf('=')
      if (separator <= 0) return result
      result[part.slice(0, separator)] = decodeURIComponent(part.slice(separator + 1))
      return result
    }, {})
}

function serializeStateCookie(value, { maxAge, secure }) {
  return [
    `${STATE_COOKIE_NAME}=${encodeURIComponent(value)}`,
    `Max-Age=${maxAge}`,
    'Path=/api/auth/wecom',
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : [])
  ].join('; ')
}

function createWecomAuthRouter(options = {}) {
  const router = express.Router()
  let defaultService
  let defaultSessionService

  function getService() {
    if (options.service) return options.service
    if (!defaultService) defaultService = createWecomAuthService()
    return defaultService
  }

  function getFrontendBaseUrl() {
    const value = String(options.frontendBaseUrl || process.env.WECOM_FRONTEND_URL || '').trim()
    if (!value) throw new Error('未配置 WECOM_FRONTEND_URL')
    return value.replace(/\/+$/, '')
  }

  function useSecureCookies() {
    if (typeof options.secureCookies === 'boolean') return options.secureCookies
    return String(process.env.WECOM_CALLBACK_URL || '').startsWith('https://')
  }

  function redirectToLogin(res, query) {
    const url = new URL('/login', `${getFrontendBaseUrl()}/`)
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
    return res.redirect(url.toString())
  }

  function getCreateSession() {
    if (options.createSession) return options.createSession
    if (!defaultSessionService) defaultSessionService = createAuthSessionService()
    return defaultSessionService.createSession
  }

  function reportCallbackError(error) {
    const details = {
      code: typeof error?.code === 'string' ? error.code : null,
      errcode: Number.isFinite(Number(error?.errcode)) ? Number(error.errcode) : null,
      name: typeof error?.name === 'string' ? error.name : 'Error'
    }
    if (options.onCallbackError) return options.onCallbackError(details)
    console.error('[WeCom SSO] callback failed', details)
  }

  async function getAccount(userId) {
    return (options.resolveAccount || resolveWecomAccount)(userId)
  }

  router.get('/start', (req, res) => {
    try {
      const service = getService()
      const state = service.issueOAuthState()
      res.setHeader('Set-Cookie', serializeStateCookie(state, {
        maxAge: STATE_MAX_AGE_SECONDS,
        secure: useSecureCookies()
      }))
      res.redirect(service.buildAuthorizationUrl(state))
    } catch (error) {
      res.status(503).json({ code: 503, message: error.message || '企微单点登录未配置', data: null })
    }
  })

  router.get('/callback', async (req, res) => {
    res.setHeader('Set-Cookie', serializeStateCookie('', {
      maxAge: 0,
      secure: useSecureCookies()
    }))

    try {
      const service = getService()
      const cookies = parseCookies(req.headers.cookie)
      if (!service.validateOAuthState(req.query.state, cookies[STATE_COOKIE_NAME])) {
        return redirectToLogin(res, { wecom_error: 'invalid_state' })
      }
      if (!req.query.code) {
        return redirectToLogin(res, { wecom_error: 'missing_code' })
      }

      const userId = await service.getUserId(req.query.code)
      await getAccount(userId)
      const ticket = service.issueLoginTicket(userId)
      return redirectToLogin(res, { wecom_ticket: ticket })
    } catch (error) {
      const errorCode = error.code === 'WECOM_ACCOUNT_NOT_FOUND'
        ? 'account_not_found'
        : error.code === 'WECOM_ACCOUNT_DISABLED'
          ? 'account_disabled'
          : 'login_failed'
      if (errorCode === 'login_failed') reportCallbackError(error)
      return redirectToLogin(res, { wecom_error: errorCode })
    }
  })

  router.post('/exchange', async (req, res) => {
    try {
      const service = getService()
      const userId = service.consumeLoginTicket(req.body?.ticket)
      if (!userId) {
        return res.status(401).json({ code: 401, message: '企微登录凭证已失效，请从企微工作台重新进入', data: null })
      }

      const user = await getAccount(userId)
      const data = await getCreateSession()({
        user,
        account: userId,
        req,
        authMethod: 'wecom'
      })
      return res.json({ code: 0, message: '登录成功', data })
    } catch (error) {
      const status = error.code === 'WECOM_ACCOUNT_DISABLED' ? 403 : 401
      return res.status(status).json({ code: status, message: error.message || '企微登录失败', data: null })
    }
  })

  return router
}

const wecomAuthRoutes = express.Router()
wecomAuthRoutes.use('/wecom', createWecomAuthRouter())

module.exports = wecomAuthRoutes
module.exports.createWecomAuthRouter = createWecomAuthRouter
module.exports.parseCookies = parseCookies
module.exports.serializeStateCookie = serializeStateCookie
