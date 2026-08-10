const crypto = require('node:crypto')

function downloadError(message, status = 403) {
  const error = new Error(message)
  error.status = status
  return error
}

function signingSecret(value) {
  const secret = value || process.env.MCP_FILE_DOWNLOAD_SECRET || process.env.JWT_SECRET
  if (!secret) throw new Error('MCP文件下载签名密钥未配置')
  return secret
}

function signature(payload, secret) {
  return crypto.createHmac('sha256', signingSecret(secret)).update(payload).digest('base64url')
}

function createDownloadToken({ uri, userId, expiresAt }, secret) {
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    uri: String(uri || ''),
    uid: Number(userId),
    exp: Number(expiresAt),
  })).toString('base64url')
  return `${payload}.${signature(payload, secret)}`
}

function verifyDownloadToken(token, secret, now = Math.floor(Date.now() / 1000)) {
  const [payload, actual, extra] = String(token || '').split('.')
  if (!payload || !actual || extra) throw downloadError('员工文件下载凭证无效')
  const expected = signature(payload, secret)
  if (actual.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
    throw downloadError('员工文件下载凭证无效')
  }
  let value
  try {
    value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    throw downloadError('员工文件下载凭证无效')
  }
  if (value?.v !== 1 || !value.uri || !Number.isSafeInteger(value.uid) || value.uid < 1 || !Number.isSafeInteger(value.exp)) {
    throw downloadError('员工文件下载凭证无效')
  }
  if (now > value.exp) throw downloadError('员工文件下载凭证已过期')
  return { uri: value.uri, userId: value.uid, expiresAt: value.exp }
}

function createDownloadUrl(uri, userId, {
  publicBaseUrl = process.env.MCP_PUBLIC_BASE_URL || process.env.PUBLIC_APP_ORIGIN || process.env.ALLOWED_ORIGIN || 'http://localhost:3104',
  ttlSeconds = Number(process.env.MCP_FILE_DOWNLOAD_TTL_SECONDS || 300),
  secret,
  now = Math.floor(Date.now() / 1000),
} = {}) {
  const ttl = Math.min(3600, Math.max(30, Number(ttlSeconds) || 300))
  const token = createDownloadToken({ uri, userId, expiresAt: now + ttl }, secret)
  return new URL(`/api/mcp/files/${encodeURIComponent(token)}`, publicBaseUrl).toString()
}

module.exports = {
  createDownloadToken,
  createDownloadUrl,
  verifyDownloadToken,
}
