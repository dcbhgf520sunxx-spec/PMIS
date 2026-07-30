const crypto = require('node:crypto')

function fileUrlError(message) {
  const error = new Error(message)
  error.statusCode = 403
  return error
}

function normalizeFilePath(value) {
  const rawPath = String(value || '').replace(/^\/+/, '')
  const filePath = rawPath.startsWith('pmis/') ? rawPath : `pmis/${rawPath}`
  if (!rawPath || filePath.includes('..') || filePath.includes('\\')) {
    throw fileUrlError('OSS文件路径不合法')
  }
  return filePath
}

function signingSecret(value) {
  const secret = value || process.env.FILE_URL_SIGNING_SECRET || process.env.JWT_SECRET
  if (!secret) throw new Error('OSS文件URL签名密钥未配置')
  return secret
}

function signatureFor(filePath, fileName, expires, secret) {
  return crypto.createHmac('sha256', secret)
    .update(`${filePath}\n${fileName}\n${expires}`)
    .digest('base64url')
}

function createOssAccessUrl({ filePath, fileName }, {
  publicOrigin = process.env.PUBLIC_APP_ORIGIN || process.env.ALLOWED_ORIGIN || 'http://localhost:3104',
  secret,
  expiresInSeconds = 600,
  now = Math.floor(Date.now() / 1000),
} = {}) {
  const normalizedPath = normalizeFilePath(filePath)
  const normalizedName = String(fileName || '文件').slice(0, 255)
  const expires = expiresInSeconds > 0 ? now + expiresInSeconds : 0
  const url = new URL('/api/files/oss', publicOrigin)
  url.searchParams.set('path', normalizedPath)
  url.searchParams.set('name', normalizedName)
  url.searchParams.set('expires', String(expires))
  url.searchParams.set('signature', signatureFor(
    normalizedPath,
    normalizedName,
    expires,
    signingSecret(secret)
  ))
  return url.toString()
}

function verifyOssAccessRequest(query = {}, {
  secret,
  now = Math.floor(Date.now() / 1000),
} = {}) {
  const filePath = normalizeFilePath(query.path)
  const fileName = String(query.name || '文件').slice(0, 255)
  const expires = Number(query.expires)
  if (!Number.isSafeInteger(expires) || expires < 0) throw fileUrlError('OSS文件URL参数不合法')
  if (expires > 0 && now > expires) throw fileUrlError('OSS文件URL已过期')
  const expected = signatureFor(filePath, fileName, expires, signingSecret(secret))
  const actual = String(query.signature || '')
  if (actual.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
    throw fileUrlError('OSS文件URL签名无效')
  }
  return { filePath, fileName }
}

module.exports = {
  createOssAccessUrl,
  normalizeFilePath,
  verifyOssAccessRequest,
}
