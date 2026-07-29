const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

test('SSO request rejects missing platform configuration instead of using legacy defaults', async () => {
  const previous = {
    platformUrl: process.env.SSO_PLATFORM_URL,
    clientId: process.env.SSO_CLIENT_ID,
    publicKey: process.env.SSO_PUBLIC_KEY_PEM
  }

  delete process.env.SSO_PLATFORM_URL
  delete process.env.SSO_CLIENT_ID
  delete process.env.SSO_PUBLIC_KEY_PEM

  try {
    const { requestTicket } = require('../src/services/ssoService')
    await assert.rejects(requestTicket('admin'), /未配置 SSO_PLATFORM_URL/)
  } finally {
    if (previous.platformUrl === undefined) delete process.env.SSO_PLATFORM_URL
    else process.env.SSO_PLATFORM_URL = previous.platformUrl
    if (previous.clientId === undefined) delete process.env.SSO_CLIENT_ID
    else process.env.SSO_CLIENT_ID = previous.clientId
    if (previous.publicKey === undefined) delete process.env.SSO_PUBLIC_KEY_PEM
    else process.env.SSO_PUBLIC_KEY_PEM = previous.publicKey
  }
})

test('SSO request accepts a bare Base64 SPKI public key and encrypts the current employee number', async () => {
  const previous = {
    platformUrl: process.env.SSO_PLATFORM_URL,
    clientId: process.env.SSO_CLIENT_ID,
    publicKey: process.env.SSO_PUBLIC_KEY_PEM,
    fetch: global.fetch
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  process.env.SSO_PLATFORM_URL = 'http://nexus.example.test'
  process.env.SSO_CLIENT_ID = 'test_client'
  process.env.SSO_PUBLIC_KEY_PEM = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')

  global.fetch = async (_url, options) => {
    const requestBody = JSON.parse(options.body)
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      Buffer.from(requestBody.encryptedData, 'base64')
    )
    const payload = JSON.parse(decrypted.toString('utf8'))
    assert.equal(requestBody.clientId, 'test_client')
    assert.equal(payload.username, 'PMIS-001')
    assert.equal(typeof payload.timestamp, 'number')
    return {
      ok: true,
      json: async () => ({ code: 0, data: { ticket: 'sso_tk_test' } })
    }
  }

  try {
    const { requestTicket } = require('../src/services/ssoService')
    assert.equal(await requestTicket('PMIS-001'), 'sso_tk_test')
  } finally {
    global.fetch = previous.fetch
    if (previous.platformUrl === undefined) delete process.env.SSO_PLATFORM_URL
    else process.env.SSO_PLATFORM_URL = previous.platformUrl
    if (previous.clientId === undefined) delete process.env.SSO_CLIENT_ID
    else process.env.SSO_CLIENT_ID = previous.clientId
    if (previous.publicKey === undefined) delete process.env.SSO_PUBLIC_KEY_PEM
    else process.env.SSO_PUBLIC_KEY_PEM = previous.publicKey
  }
})

test('SSO request rejects a successful response without a usable ticket', async () => {
  const previousFetch = global.fetch
  const previousPlatformUrl = process.env.SSO_PLATFORM_URL
  const previousClientId = process.env.SSO_CLIENT_ID
  const previousPublicKey = process.env.SSO_PUBLIC_KEY_PEM
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  process.env.SSO_PLATFORM_URL = 'http://nexus.example.test'
  process.env.SSO_CLIENT_ID = 'test_client'
  process.env.SSO_PUBLIC_KEY_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ code: 0, data: {} })
  })

  try {
    const { requestTicket } = require('../src/services/ssoService')
    await assert.rejects(requestTicket('PMIS-001'), /未返回有效 ticket/)
  } finally {
    global.fetch = previousFetch
    if (previousPlatformUrl === undefined) delete process.env.SSO_PLATFORM_URL
    else process.env.SSO_PLATFORM_URL = previousPlatformUrl
    if (previousClientId === undefined) delete process.env.SSO_CLIENT_ID
    else process.env.SSO_CLIENT_ID = previousClientId
    if (previousPublicKey === undefined) delete process.env.SSO_PUBLIC_KEY_PEM
    else process.env.SSO_PUBLIC_KEY_PEM = previousPublicKey
  }
})
