const crypto = require('node:crypto')

const AES_VERSION = 'v1'
const RSA_VERSION = 'v2'
const ASSERTION_VERSION = 'v3'
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

function assertionPayloadText(payload) {
  return [
    payload.employeeNo,
    payload.clientId,
    payload.endpointType,
    payload.issuedAt,
    payload.expiresAt,
    payload.nonce,
  ].join('\n')
}

function assertionSignature(payload, signingSecret) {
  const secret = String(signingSecret || '').trim()
  if (!secret) throw new McpEmployeeIdentityError('员工身份签名密钥未配置')
  return crypto.createHmac('sha256', secret)
    .update(assertionPayloadText(payload), 'utf8')
    .digest('base64url')
    .slice(0, 22)
}

function createEmployeeIdentityAssertion(employeeNo, {
  clientId,
  endpointType,
  now = Date.now(),
  ttlMs = 2 * 60 * 1000,
  nonce = crypto.randomUUID(),
  signingSecret = process.env.MCP_EMPLOYEE_ASSERTION_SECRET,
  rsaPublicKey,
} = {}) {
  const issuedAt = Math.trunc(Number(now))
  const payload = {
    employeeNo: assertEmployeeNo(employeeNo),
    clientId: Number(clientId),
    endpointType: String(endpointType || ''),
    issuedAt,
    expiresAt: issuedAt + Math.max(1, Math.trunc(Number(ttlMs))),
    nonce: String(nonce || ''),
  }
  if (!Number.isSafeInteger(payload.clientId) || payload.clientId <= 0
    || !['query', 'action'].includes(payload.endpointType)
    || !/^[A-Za-z0-9_.:-]{1,64}$/.test(payload.nonce)) {
    throw new McpEmployeeIdentityError('员工身份凭证参数无效')
  }
  payload.signature = assertionSignature(payload, signingSecret)
  const compactPayload = {
    e: payload.employeeNo,
    c: payload.clientId,
    t: payload.endpointType,
    i: payload.issuedAt,
    x: payload.expiresAt,
    n: payload.nonce,
    s: payload.signature,
  }
  let encrypted
  try {
    encrypted = crypto.publicEncrypt({
      key: rsaPublicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    }, Buffer.from(JSON.stringify(compactPayload), 'utf8'))
  } catch {
    throw new McpEmployeeIdentityError('员工身份凭证生成失败')
  }
  return `${ASSERTION_VERSION}.${encrypted.toString('base64url')}`
}

function decryptSignedEmployeeIdentity(encrypted, {
  now,
  clientId,
  endpointType,
  signingSecret,
  rsaPrivateKeyBase64,
  consumeNonce,
}) {
  const parts = String(encrypted || '').split('.')
  if (parts.length !== 2 || parts[0] !== ASSERTION_VERSION) {
    throw new McpEmployeeIdentityError('员工身份凭证格式无效')
  }
  try {
    const privateKeyBase64 = String(rsaPrivateKeyBase64 || '').trim()
    if (!privateKeyBase64) throw new Error('missing key material')
    const decrypted = crypto.privateDecrypt({
      key: Buffer.from(privateKeyBase64, 'base64').toString('utf8'),
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    }, decodePart(parts[1]))
    const compactPayload = JSON.parse(decrypted.toString('utf8'))
    const payload = {
      employeeNo: compactPayload.e,
      clientId: compactPayload.c,
      endpointType: compactPayload.t,
      issuedAt: compactPayload.i,
      expiresAt: compactPayload.x,
      nonce: compactPayload.n,
      signature: compactPayload.s,
    }
    const currentTime = Math.trunc(Number(now))
    assertEmployeeNo(payload.employeeNo)
    const expected = Buffer.from(assertionSignature(payload, signingSecret), 'utf8')
    const actual = Buffer.from(String(payload.signature || ''), 'utf8')
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      throw new McpEmployeeIdentityError('员工身份凭证签名校验失败')
    }
    if (Number(payload.clientId) !== Number(clientId)
      || payload.endpointType !== endpointType) {
      throw new McpEmployeeIdentityError('员工身份凭证使用范围不匹配')
    }
    if (!Number.isInteger(payload.issuedAt) || !Number.isInteger(payload.expiresAt)
      || payload.issuedAt > currentTime + MAX_FUTURE_SKEW_MS
      || payload.expiresAt <= currentTime
      || payload.expiresAt - payload.issuedAt > MAX_AGE_MS) {
      throw new McpEmployeeIdentityError('员工身份凭证已过期或时间无效')
    }
    if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(String(payload.nonce || ''))) {
      throw new McpEmployeeIdentityError('员工身份凭证一次性编号无效')
    }
    if (consumeNonce && consumeNonce(payload.nonce, payload.expiresAt, {
      employeeNo: payload.employeeNo,
      clientId: payload.clientId,
      endpointType: payload.endpointType,
    }) === false) {
      throw new McpEmployeeIdentityError('员工身份凭证已经使用')
    }
    return payload.employeeNo
  } catch (error) {
    if (error instanceof McpEmployeeIdentityError) throw error
    throw new McpEmployeeIdentityError('员工身份凭证校验失败')
  }
}

function decryptEmployeeIdentity(encrypted, token, {
  now = Date.now(),
  maxAgeMs = MAX_AGE_MS,
  rsaPrivateKeyBase64 = process.env.MCP_EMPLOYEE_RSA_PRIVATE_KEY_BASE64,
  clientId,
  endpointType,
  signingSecret = process.env.MCP_EMPLOYEE_ASSERTION_SECRET,
  consumeNonce,
  allowLegacy = process.env.MCP_EMPLOYEE_LEGACY_IDENTITY_ENABLED !== 'false',
} = {}) {
  if (String(encrypted || '').startsWith(`${ASSERTION_VERSION}.`)) {
    return decryptSignedEmployeeIdentity(encrypted, {
      now,
      clientId,
      endpointType,
      signingSecret,
      rsaPrivateKeyBase64,
      consumeNonce,
    })
  }
  if (!allowLegacy) {
    throw new McpEmployeeIdentityError('旧版员工身份凭证已停用，请更新MCP请求头配置')
  }
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
  createEmployeeIdentityAssertion,
  decryptEmployeeIdentity,
  encryptEmployeeIdentity,
}
