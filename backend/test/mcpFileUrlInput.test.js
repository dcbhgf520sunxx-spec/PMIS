const assert = require('node:assert/strict')
const test = require('node:test')

const { buildFileFromUrl } = require('../src/mcp/actionTools')
const { getToolDefinition } = require('../src/mcp/catalog')

const pdf = Buffer.from('%PDF-1.7\n')

test('MCP文件工具元数据只公开file_url而不再接受content_base64', () => {
  for (const name of ['contract_attachment_upload', 'stage_delivery_upload']) {
    const schema = getToolDefinition(name, 'action').inputSchema
    assert.equal(schema.required.includes('file_url'), true)
    assert.equal(Object.hasOwn(schema.properties, 'content_base64'), false)
    assert.match(schema.properties.file_url.description, /OSS/)
  }
})

test('MCP文件操作从允许的OSS URL读取文件且不需要Base64', async () => {
  let requestOptions
  const file = await buildFileFromUrl({
    file_name: '合同.pdf',
    file_url: 'https://oss.example.com/pmis/contracts/a.pdf',
  }, {
    allowedOrigins: ['https://oss.example.com'],
    fetchImpl: async (_url, options) => {
      requestOptions = options
      return new Response(pdf, {
      status: 200,
      headers: { 'content-type': 'application/pdf', 'content-length': String(pdf.length) },
      })
    },
  })

  assert.equal(file.originalname, '合同.pdf')
  assert.equal(file.mimetype, 'application/pdf')
  assert.deepEqual(file.buffer, pdf)
  assert.equal(requestOptions.redirect, 'manual')
})

test('MCP文件操作拒绝通过重定向绕过OSS白名单', async () => {
  await assert.rejects(
    () => buildFileFromUrl({
      file_name: '合同.pdf',
      file_url: 'https://oss.example.com/pmis/contracts/a.pdf',
    }, {
      allowedOrigins: ['https://oss.example.com'],
      fetchImpl: async () => new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1:5432/private' },
      }),
    }),
    (error) => error.fieldErrors?.file_url === '文件URL不允许重定向'
  )
})

test('MCP文件操作拒绝非白名单地址以避免服务端请求伪造', async () => {
  await assert.rejects(
    () => buildFileFromUrl({
      file_name: '合同.pdf',
      file_url: 'http://127.0.0.1:5432/private',
    }, {
      allowedOrigins: ['https://oss.example.com'],
      fetchImpl: async () => { throw new Error('不应发起请求') },
    }),
    (error) => error.fieldErrors?.file_url === '文件URL不在允许的OSS地址范围内'
  )
})

test('MCP文件操作在下载过程中执行大小上限而不是无限读取', async () => {
  const oversized = Buffer.alloc(6 * 1024 * 1024)
  await assert.rejects(
    () => buildFileFromUrl({
      file_name: '合同.pdf',
      file_url: 'https://oss.example.com/pmis/contracts/a.pdf',
    }, {
      allowedOrigins: ['https://oss.example.com'],
      limit: 5 * 1024 * 1024,
      fetchImpl: async () => new Response(oversized, {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      }),
    }),
    (error) => /文件过大/.test(error.fieldErrors?.file_url || '')
  )
})
