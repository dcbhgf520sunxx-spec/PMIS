const assert = require('node:assert/strict')
const test = require('node:test')
const { sanitizeRichText } = require('../src/services/richTextSanitizer')

test('removes script, event handlers and dangerous links from rich text', () => {
  const result = sanitizeRichText('<unknown><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">链接</a><script>alert(1)</script></unknown>')
  assert.doesNotMatch(result, /script|onerror|javascript:/i)
  assert.match(result, /链接/)
})

test('keeps confirmed safe rich text features', () => {
  const result = sanitizeRichText('<p><strong>加粗</strong></p><ul><li>列表</li></ul><a href="https://example.com">链接</a><img src="data:image/png;base64,AA==" width="1200">')
  assert.match(result, /<strong>加粗<\/strong>/)
  assert.match(result, /<li>列表<\/li>/)
  assert.match(result, /href="https:\/\/example\.com"/)
  assert.match(result, /data:image\/png;base64,AA==/)
  assert.match(result, /width="960"/)
})
