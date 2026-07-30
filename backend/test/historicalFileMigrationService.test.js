const assert = require('node:assert/strict')
const test = require('node:test')

const {
  migrateRichTextDataImages,
  toImageFile,
} = require('../src/services/historicalFileMigrationService')

const pngData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'

test('历史富文本将内嵌图片逐个上传并仅用URL替换src', async () => {
  const uploaded = []
  const html = `<p>说明</p><img width="120" src="data:image/png;base64,${pngData}"><img src="https://files.example.com/a.png">`
  const result = await migrateRichTextDataImages(html, {
    uploadImage: async (file) => {
      uploaded.push(file)
      return { url: 'https://pmis.example.com/api/files/oss?s=1' }
    },
  })

  assert.equal(result.migratedCount, 1)
  assert.match(result.value, /width="120"/)
  assert.match(result.value, /src="https:\/\/pmis\.example\.com\/api\/files\/oss\?s=1"/)
  assert.match(result.value, /src="https:\/\/files\.example\.com\/a\.png"/)
  assert.doesNotMatch(result.value, /data:image|base64/i)
  assert.equal(uploaded[0].mimetype, 'image/png')
  assert.match(uploaded[0].originalname, /\.png$/)
})

test('历史富文本任一图片上传失败时抛错并由调用方保持整字段原值', async () => {
  const html = `<img src="data:image/png;base64,${pngData}">`
  await assert.rejects(
    () => migrateRichTextDataImages(html, {
      uploadImage: async () => { throw new Error('OSS不可用') },
    }),
    /OSS不可用/
  )
  assert.match(html, /data:image/)
})

test('历史图片转换拒绝非图片Data URL和无效Base64', () => {
  assert.throws(() => toImageFile('text/plain', 'SGVsbG8=', 1), /不支持/)
  assert.throws(() => toImageFile('image/png', '%%%', 1), /Base64/)
})
