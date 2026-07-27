const crypto = require('node:crypto')

const VERSION = 'v1'
const KEY_CONTEXT = 'pmis-mcp-employee:v1:'
const MAX_AGE_MS = 5 * 60 * 1000
const MAX_FUTURE_SKEW_MS = 60 * 1000
const EMPLOYEE_NO_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/

class McpEmployeeIdentityError extends Error {
  constructor(message) {
    super(message)
    this.name = 'McpEmployeeIdentityError'
  }
}

function deriveKey(token) {
  return crypto.createHash('sha256').update(`${KEY_CONTEXT}${token}`).digest()
}

function aad(issuedAt) {
  return Buffer.from(`${KEY_CONTEXT}${issuedAt}`, 'utf8')
}

function assertEmployeeNo(employeeNo) {
  const normalized = String(employeeNo || '').trim()
  if (!EMPLOYEE_NO_PATTERN.test(normalized)) {
    throw new McpEmployeeIdentityError('员工号格式无效')
  }
  return normalized
}

function encryptEmployeeIdentity(employeeNo, token, { now = Date.now() } = {}) {
  const normalizedEmployeeNo = assertEmployeeNo(employeeNo)
  const normalizedToken = String(token || '').trim()
  if (!normalizedToken) throw new McpEmployeeIdentityError('MCP凭据不能为空')

  const issuedAt = Math.trunc(Number(now))
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(normalizedToken), iv)
  cipher.setAAD(aad(issuedAt))
  const ciphertext = Buffer.concat([
    cipher.update(normalizedEmployeeNo, 'utf8'),
    cipher.final(),
  ])

  return [
    VERSION,
    issuedAt,
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
  ].join('.')
}

function decodePart(value) {
  if (!BASE64URL_PATTERN.test(value)) {
    throw new McpEmployeeIdentityError('员工号密文格式无效')
  }
  return Buffer.from(value, 'base64url')
}

function decryptEmployeeIdentity(encrypted, token, {
  now = Date.now(),
  maxAgeMs = MAX_AGE_MS,
} = {}) {
  const parts = String(encrypted || '').split('.')
  if (parts.length !== 5 || parts[0] !== VERSION || !/^\d{13}$/.test(parts[1])) {
    throw new McpEmployeeIdentityError('员工号密文格式无效')
  }

  const issuedAt = Number(parts[1])
  const currentTime = Math.trunc(Number(now))
  if (issuedAt > currentTime + MAX_FUTURE_SKEW_MS) {
    throw new McpEmployeeIdentityError('员工号密文时间无效')
  }
  if (currentTime - issuedAt > maxAgeMs) {
    throw new McpEmployeeIdentityError('员工号密文已过期')
  }

  try {
    const normalizedToken = String(token || '').trim()
    if (!normalizedToken) throw new Error('missing token')
    const iv = decodePart(parts[2])
    const ciphertext = decodePart(parts[3])
    const authTag = decodePart(parts[4])
    if (iv.length !== 12 || authTag.length !== 16 || ciphertext.length === 0) {
      throw new Error('invalid payload size')
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(normalizedToken), iv)
    decipher.setAAD(aad(issuedAt))
    decipher.setAuthTag(authTag)
    const employeeNo = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8')
    return assertEmployeeNo(employeeNo)
  } catch (error) {
    if (error instanceof McpEmployeeIdentityError) throw error
    throw new McpEmployeeIdentityError('员工号密文校验失败')
  }
}

module.exports = {
  MAX_AGE_MS,
  McpEmployeeIdentityError,
  decryptEmployeeIdentity,
  encryptEmployeeIdentity,
}
