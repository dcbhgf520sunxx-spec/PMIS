const { createHash, randomBytes, randomInt, timingSafeEqual } = require('node:crypto')
const svgCaptcha = require('svg-captcha')
const { Resvg } = require('@resvg/resvg-js')

const CHARACTERS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const TTL_MS = 2 * 60 * 1000
const RATE_WINDOW_MS = 60 * 1000
const MAX_ENTRIES = 5000

function digest(text) {
  return createHash('sha256').update(text).digest()
}

function renderCaptchaImage(text) {
  const svg = svgCaptcha(text, { width: 150, height: 44, fontSize: 42, noise: 3, color: false })
  // 只返回像素，防止通过逐字形 SVG 路径直接还原答案。
  return new Resvg(svg, { font: { loadSystemFonts: false }, background: '#f0f5ff' }).render().asPng()
}

function createLoginCaptchaService({ now = Date.now, renderImage = renderCaptchaImage } = {}) {
  // shortcut: 单进程短期缓存；多进程部署时须改用共享存储和原子消费。
  const challenges = new Map()
  const requests = new Map()
  let nextCleanupAt = 0

  function issue(clientIp) {
    const time = now()
    if (time >= nextCleanupAt || challenges.size >= MAX_ENTRIES || requests.size >= MAX_ENTRIES) {
      for (const [key, value] of challenges) {
        if (value.expiresAt <= time) challenges.delete(key)
      }
      for (const [key, value] of requests) {
        if (value.expiresAt <= time) requests.delete(key)
      }
      nextCleanupAt = time + 10000
    }
    let rate = requests.get(clientIp)
    if (!rate || rate.expiresAt <= time) {
      rate = { count: 0, expiresAt: time + RATE_WINDOW_MS }
    }
    if (rate.count >= 300 || challenges.size >= MAX_ENTRIES || (!requests.has(clientIp) && requests.size >= MAX_ENTRIES)) {
      const error = new Error('验证码获取过于频繁，请稍后重试')
      error.statusCode = 429
      throw error
    }
    rate.count++
    requests.set(clientIp, rate)

    const text = Array.from({ length: 5 }, () => CHARACTERS[randomInt(CHARACTERS.length)]).join('')
    const image = renderImage(text)
    const id = randomBytes(24).toString('base64url')
    challenges.set(id, { answer: digest(text), clientIp, expiresAt: time + TTL_MS })
    return { captcha_id: id, image: `data:image/png;base64,${Buffer.from(image).toString('base64')}`, expires_in: TTL_MS / 1000 }
  }

  function consume(clientIp, id, code) {
    if (typeof id !== 'string') return false
    const challenge = challenges.get(id)
    if (!challenge) return false
    challenges.delete(id)
    if (challenge.clientIp !== clientIp || challenge.expiresAt <= now() || typeof code !== 'string') return false
    const normalized = code.trim().toUpperCase()
    if (!/^[A-Z2-9]{5}$/.test(normalized)) return false
    return timingSafeEqual(challenge.answer, digest(normalized))
  }

  return { issue, consume }
}

module.exports = { createLoginCaptchaService, renderCaptchaImage }
