const crypto = require('node:crypto')

const AES_VERSION = 'v1'
const RSA_VERSION = 'v2'
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
    AES_VERSION,
    issuedAt,
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
  ].join('.')
}

function assertIssuedAt(issuedAt, currentTime, maxAgeMs) {
  if (!Number.isInteger(issuedAt) || !/^\d{13}$/.test(String(issuedAt))) {
    throw new McpEmployeeIdentityError('员工号密文时间无效')
  }
  if (issuedAt > currentTime + MAX_FUTURE_SKEW_MS) {
    throw new McpEmployeeIdentityError('员工号密文时间无效')
  }
  if (currentTime - issuedAt > maxAgeMs) {
    throw new McpEmployeeIdentityError('员工号密文已过期')
  }
}

function decodePart(value) {
  if (!BASE64URL_PATTERN.test(value)) {
    throw new McpEmployeeIdentityError('员工号密文格式无效')
  }
  return Buffer.from(value, 'base64url')
}

function decryptAesEmployeeIdentity(encrypted, token, { now, maxAgeMs }) {
  const parts = String(encrypted || '').split('.')
  if (parts.length !== 5 || parts[0] !== AES_VERSION || !/^\d{13}$/.test(parts[1])) {
    throw new McpEmployeeIdentityError('员工号密文格式无效')
  }

  const issuedAt = Number(parts[1])
  const currentTime = Math.trunc(Number(now))
  assertIssuedAt(issuedAt, currentTime, maxAgeMs)

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

function decryptRsaEmployeeIdentity(encrypted, {
  now,
  maxAgeMs,
  rsaPrivateKeyBase64,
}) {
  const parts = String(encrypted || '').split('.')
  if (parts.length !== 2 || parts[0] !== RSA_VERSION) {
    throw new McpEmployeeIdentityError('员工号密文格式无效')
  }

  try {
    const privateKeyBase64 = String(rsaPrivateKeyBase64 || '').trim()
    if (!privateKeyBase64) throw new Error('missing key material')

    const decrypted = crypto.privateDecrypt({
      key: Buffer.from(privateKeyBase64, 'base64').toString('utf8'),
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    }, decodePart(parts[1]))
    const payload = JSON.parse(decrypted.toString('utf8'))

    assertIssuedAt(Number(payload.issuedAt), Math.trunc(Number(now)), maxAgeMs)
    return assertEmployeeNo(payload.employeeNo)
  } catch (error) {
    if (error instanceof McpEmployeeIdentityError) throw error
    throw new McpEmployeeIdentityError('员工号密文校验失败')
  }
}

function decryptEmployeeIdentity(encrypted, token, {
  now = Date.now(),
  maxAgeMs = MAX_AGE_MS,
  rsaPrivateKeyBase64 = process.env.MCP_EMPLOYEE_RSA_PRIVATE_KEY_BASE64,
} = {}) {
  if (String(encrypted || '').startsWith(`${RSA_VERSION}.`)) {
    return decryptRsaEmployeeIdentity(encrypted, {
      now,
      maxAgeMs,
      rsaPrivateKeyBase64,
    })
  }
  return decryptAesEmployeeIdentity(encrypted, token, { now, maxAgeMs })
}

module.exports = {
  MAX_AGE_MS,
  McpEmployeeIdentityError,
  decryptEmployeeIdentity,
  encryptEmployeeIdentity,
}
