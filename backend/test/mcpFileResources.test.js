const assert = require('node:assert/strict')
const test = require('node:test')

const {
  listResourceTemplates,
  loadResourceDescriptor,
  parsePmisResourceUri,
  toMcpUrlResource,
} = require('../src/mcp/fileResources')
const {
  createDownloadToken,
  verifyDownloadToken,
} = require('../src/services/mcpFileDownloadService')

test('parses only governed PMIS business attachment resource URIs', () => {
  assert.deepEqual(
    parsePmisResourceUri('pmis://projects/12/contract/attachments/34'),
    { type: 'contract', projectId: 12, attachmentId: 34 }
  )
  assert.deepEqual(
    parsePmisResourceUri('pmis://projects/12/stage-plan/items/56/files/78'),
    { type: 'stage', projectId: 12, itemId: 56, fileId: 78 }
  )
  assert.deepEqual(
    parsePmisResourceUri('pmis://products/7/maintenance-contracts/9/attachments/11'),
    { type: 'maintenance', productId: 7, contractId: 9, attachmentId: 11 }
  )
  assert.throws(() => parsePmisResourceUri('file:///etc/passwd'), /资源地址/)
})

test('lists only URL-based resource templates permitted by employee menus', async () => {
  const projects = await listResourceTemplates({ allowedMenuPaths: new Set(['/projects']) })
  assert.deepEqual(projects.map((item) => item.name), ['项目合同附件', '阶段计划交付文件'])
  assert.equal(projects.every((item) => /URL/.test(item.description)), true)

  const products = await listResourceTemplates({ allowedMenuPaths: new Set(['/products']) })
  assert.deepEqual(products.map((item) => item.name), ['产品运维合同附件'])
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

test('loads current product maintenance attachment as signed URL metadata without file bytes', async () => {
  const descriptor = await loadResourceDescriptor(
    'pmis://products/7/maintenance-contracts/9/attachments/11',
    { allowedMenuPaths: new Set(['/products']) },
    {
      database: {
        prepare(sql) {
          assert.match(sql, /pms_product_maintenance_contract_attachment/)
          return {
            async get() {
              return {
                original_name: '年度运维合同.pdf',
                storage_name: 'pmis/contracts/11.pdf',
                oss_response: { data: [{
                  id: '11', fileName: '11.pdf', filePath: 'pmis/contracts/11.pdf',
                  fileUrl: 'http://oss.znjs.com:9000/pmis/contracts/11.pdf',
                }] },
                mime_type: 'application/pdf',
                file_size: 1024,
              }
            },
          }
        },
      },
      resolveFile: () => ({ filePath: 'pmis/contracts/11.pdf' }),
      createAccessUrl: ({ fileName }) => `https://pmis.example.com/api/files/oss?name=${encodeURIComponent(fileName)}`,
    }
  )

  assert.equal(descriptor.fileName, '年度运维合同.pdf')
  assert.match(descriptor.fileUrl, /^https:\/\/pmis\.example\.com\/api\/files\/oss/)
  assert.equal(Object.hasOwn(descriptor, 'buffer'), false)
  assert.equal(Object.hasOwn(descriptor, 'blob'), false)
})

test('temporary download token is bound to one employee and resource and expires', () => {
  const secret = 'test-secret-with-enough-entropy'
  const token = createDownloadToken({
    uri: 'pmis://projects/12/contract/attachments/34',
    userId: 8,
    expiresAt: 1_700_000_300,
  }, secret)

  assert.deepEqual(verifyDownloadToken(token, secret, 1_700_000_000), {
    uri: 'pmis://projects/12/contract/attachments/34',
    userId: 8,
    expiresAt: 1_700_000_300,
  })
  assert.throws(() => verifyDownloadToken(`${token}x`, secret, 1_700_000_000), /无效/)
  assert.throws(() => verifyDownloadToken(token, secret, 1_700_000_301), /过期/)
})
