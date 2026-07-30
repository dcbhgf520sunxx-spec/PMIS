const assert = require('node:assert/strict')
const test = require('node:test')

const {
  normalizeMcpQueryContent,
  summarizeRichText,
} = require('../src/mcp/contentPolicy')

test('列表查询把富文本转换为纯文字摘要且不返回内嵌图片', () => {
  const result = normalizeMcpQueryContent({
    items: [{
      id: 1,
      problem_desc: '<p>服务器异常</p><img src="data:image/png;base64,AAAA" alt="截图">',
    }],
    total: 1,
  }, { summary: true })

  assert.deepEqual(result, {
    items: [{ id: 1, problem_desc: '服务器异常 〔图片〕' }],
    total: 1,
  })
  assert.doesNotMatch(JSON.stringify(result), /base64/i)
})

test('详情查询保留富文本中的OSS链接但移除遗留Base64图片', () => {
  const result = normalizeMcpQueryContent({
    description: '<p>处理说明</p><img src="https://oss.example.com/pmis/a.png"><img src="data:image/png;base64,BBBB">',
  })

  assert.match(result.description, /https:\/\/oss\.example\.com\/pmis\/a\.png/)
  assert.match(result.description, /图片尚未迁移/)
  assert.doesNotMatch(result.description, /data:image|base64/i)
})

test('富文本摘要保留图片存在性而不暴露HTML和文件内容', () => {
  assert.equal(
    summarizeRichText('<p>结论<strong>通过</strong></p><img src="https://oss.example.com/a.png">'),
    '结论通过 〔图片〕'
  )
})
