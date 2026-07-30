const assert = require('node:assert/strict')
const test = require('node:test')

const { parsePmisResourceUri, toMcpUrlResource } = require('../src/mcp/fileResources')

test('parses only governed PMIS contract and stage delivery resource URIs', () => {
  assert.deepEqual(
    parsePmisResourceUri('pmis://projects/12/contract/attachments/34'),
    { type: 'contract', projectId: 12, attachmentId: 34 }
  )
  assert.deepEqual(
    parsePmisResourceUri('pmis://projects/12/stage-plan/items/56/files/78'),
    { type: 'stage', projectId: 12, itemId: 56, fileId: 78 }
  )
  assert.throws(() => parsePmisResourceUri('file:///etc/passwd'), /资源地址/)
})

test('returns governed file metadata and URL without embedding file bytes', () => {
  const resource = toMcpUrlResource({
    uri: 'pmis://projects/1/contract/attachments/2',
    mimeType: 'application/pdf',
    fileName: '合同.pdf',
    fileSize: 1024,
    fileUrl: 'https://oss.example.com/pmis/contract.pdf',
  })
  assert.equal(resource.mimeType, 'application/pdf')
  assert.deepEqual(JSON.parse(resource.text), {
    file_name: '合同.pdf',
    file_size: 1024,
    file_url: 'https://oss.example.com/pmis/contract.pdf',
  })
  assert.equal(Object.hasOwn(resource, 'blob'), false)
})
