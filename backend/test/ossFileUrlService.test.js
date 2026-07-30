const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createOssAccessUrl,
  verifyOssAccessRequest,
} = require('../src/services/ossFileUrlService')

test('生成同源签名URL并校验文件路径和有效期', () => {
  const now = 1_800_000_000
  const url = createOssAccessUrl({
    filePath: 'pmis/rich-text/a.png',
    fileName: '截图.png',
  }, {
    publicOrigin: 'https://gcglsys.znjs.com:9088',
    secret: 'test-signing-secret',
    expiresInSeconds: 600,
    now,
  })
  const parsed = new URL(url)
  assert.equal(parsed.origin, 'https://gcglsys.znjs.com:9088')
  assert.equal(parsed.pathname, '/api/files/oss')

  assert.deepEqual(verifyOssAccessRequest(Object.fromEntries(parsed.searchParams), {
    secret: 'test-signing-secret',
    now: now + 10,
  }), {
    filePath: 'pmis/rich-text/a.png',
    fileName: '截图.png',
  })
})

test('签名URL拒绝路径篡改和过期访问', () => {
  const url = new URL(createOssAccessUrl({
    filePath: 'pmis/a.pdf',
    fileName: 'a.pdf',
  }, {
    publicOrigin: 'https://pmis.example.com',
    secret: 'test-signing-secret',
    expiresInSeconds: 60,
    now: 100,
  }))
  const query = Object.fromEntries(url.searchParams)

  assert.throws(
    () => verifyOssAccessRequest({ ...query, path: 'pmis/private.pdf' }, {
      secret: 'test-signing-secret',
      now: 110,
    }),
    /签名无效/
  )
  assert.throws(
    () => verifyOssAccessRequest(query, {
      secret: 'test-signing-secret',
      now: 200,
    }),
    /已过期/
  )
})
