const assert = require('node:assert/strict')
const test = require('node:test')

const {
  uploadRichTextImageToOss,
  validateRichTextImage,
} = require('../src/services/richTextImageOssService')

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])

test('富文本图片校验真实格式和5MB上限', () => {
  assert.doesNotThrow(() => validateRichTextImage({
    originalname: '截图.png',
    mimetype: 'image/png',
    buffer: png,
  }))
  assert.throws(() => validateRichTextImage({
    originalname: '截图.png',
    mimetype: 'image/png',
    buffer: Buffer.from('not png'),
  }), /内容与类型不匹配/)
  assert.throws(() => validateRichTextImage({
    originalname: '截图.png',
    mimetype: 'image/png',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  }), /不能超过5MB/)
})

test('富文本图片上传OSS后只返回受信任URL', async () => {
  const payload = {
    code: 100,
    data: [{
      id: 'image-1',
      fileName: '截图.png',
      filePath: 'pmis/rich-text/image-1.png',
      fileUrl: 'http://oss.znjs.com:9000/pmis/rich-text/image-1.png',
    }],
  }
  const saved = await uploadRichTextImageToOss({
    originalname: '截图.png',
    mimetype: 'image/png',
    buffer: png,
  }, {
    fetchImpl: async () => new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
    accessUrlOptions: {
      publicOrigin: 'https://pmis.example.com',
      secret: 'test-signing-secret',
    },
  })

  assert.equal(new URL(saved.url).origin, 'https://pmis.example.com')
  assert.equal(new URL(saved.url).pathname, '/api/files/oss')
  assert.doesNotMatch(saved.url, /oss\.znjs\.com/)
  assert.deepEqual(saved.ossResponse, payload)
})
