const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const test = require('node:test')

const {
  decryptEmployeeIdentity,
  encryptEmployeeIdentity,
} = require('../src/services/mcpEmployeeIdentityCrypto')

const rsaKeys = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

function rsaEnvelope(employeeNo, issuedAt) {
  const payload = JSON.stringify({
    employeeNo,
    issuedAt,
  })
  const encrypted = crypto.publicEncrypt({
    key: rsaKeys.publicKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256',
  }, Buffer.from(payload, 'utf8'))
  return `v2.${encrypted.toString('base64url')}`
}

test('employee identity ciphertext round-trips and hides the employee number', () => {
  const encrypted = encryptEmployeeIdentity('005829', 'fixed-token', { now: 1_722_000_000_000 })

  assert.equal(encrypted.includes('005829'), false)
  assert.equal(decryptEmployeeIdentity(encrypted, 'fixed-token', {
    now: 1_722_000_030_000,
  }), '005829')
})

test('employee identity ciphertext is non-deterministic', () => {
  const first = encryptEmployeeIdentity('005829', 'fixed-token')
  const second = encryptEmployeeIdentity('005829', 'fixed-token')

  assert.notEqual(first, second)
})

test('RSA employee identity envelope round-trips with OAEP-SHA256', () => {
  const encrypted = rsaEnvelope('004825', 1_722_000_000_000)

  assert.equal(encrypted.includes('004825'), false)
  assert.equal(decryptEmployeeIdentity(encrypted, 'query-token', {
    now: 1_722_000_030_000,
    rsaPrivateKeyBase64: Buffer.from(rsaKeys.privateKey).toString('base64'),
  }), '004825')
})

test('RSA employee identity envelope relies on the separately authenticated MCP token', () => {
  const encrypted = rsaEnvelope('004825', 1_722_000_000_000)

  assert.equal(decryptEmployeeIdentity(encrypted, 'action-token', {
    now: 1_722_000_030_000,
    rsaPrivateKeyBase64: Buffer.from(rsaKeys.privateKey).toString('base64'),
  }), '004825')
})

test('RSA employee identity envelope rejects expired payloads', () => {
  const encrypted = rsaEnvelope('004825', 1_722_000_000_000)

  assert.throws(() => decryptEmployeeIdentity(encrypted, 'query-token', {
    now: 1_722_000_300_001,
    rsaPrivateKeyBase64: Buffer.from(rsaKeys.privateKey).toString('base64'),
  }), /员工号密文已过期/)
})
