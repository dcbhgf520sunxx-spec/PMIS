const assert = require('node:assert/strict')
const test = require('node:test')

const { parsePmisResourceUri, toMcpBlobResource } = require('../src/mcp/fileResources')

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

test('returns MIME-preserving base64 content and rejects oversized inline files', () => {
  const resource = toMcpBlobResource({
    uri: 'pmis://projects/1/contract/attachments/2',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7'),
  }, 20)
  assert.equal(resource.mimeType, 'application/pdf')
  assert.equal(Buffer.from(resource.blob, 'base64').toString(), '%PDF-1.7')
  assert.equal(Object.hasOwn(resource, 'path'), false)

  assert.throws(() => toMcpBlobResource({
    uri: 'pmis://projects/1/contract/attachments/2',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(21),
  }, 20), /过大/)
})
