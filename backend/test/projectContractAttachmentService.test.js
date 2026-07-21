const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const servicePath = path.join(__dirname, '../src/services/projectContractAttachmentService.js')

test('项目合同附件使用独立私有文件服务', () => {
  assert.ok(fs.existsSync(servicePath), '缺少项目合同附件私有文件服务')
})

test('项目合同附件只接受白名单类型且单文件不超过20MB', () => {
  const { normalizeOriginalName, validateAttachmentFile } = require(servicePath)
  assert.equal(typeof validateAttachmentFile, 'function')
  assert.equal(normalizeOriginalName(Buffer.from('合同.pdf', 'utf8').toString('latin1')), '合同.pdf')
  const pdf = Buffer.from('%PDF-1.7 contract')
  assert.deepEqual(validateAttachmentFile({ originalname: '合同.pdf', mimetype: 'application/pdf', size: pdf.length, buffer: pdf }), { extension: '.pdf' })
  assert.throws(
    () => validateAttachmentFile({ originalname: '病毒.exe', mimetype: 'application/octet-stream', size: 4, buffer: Buffer.from('MZ00') }),
    /不支持该文件类型/
  )
  assert.throws(
    () => validateAttachmentFile({ originalname: '超大.pdf', mimetype: 'application/pdf', size: 20971521, buffer: pdf }),
    /不能超过20MB/
  )
  assert.throws(
    () => validateAttachmentFile({ originalname: '伪装.pdf', mimetype: 'application/pdf', size: 4, buffer: Buffer.from('MZ00') }),
    /文件内容与类型不匹配/
  )
})

test('项目合同附件保存到私有目录并能安全清理', async (t) => {
  const os = require('node:os')
  const fsp = require('node:fs/promises')
  const { saveAttachmentFile, removeAttachmentFile } = require(servicePath)
  assert.equal(typeof saveAttachmentFile, 'function')
  assert.equal(typeof removeAttachmentFile, 'function')
  const rootDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pmis-contract-attachment-'))
  t.after(() => fsp.rm(rootDir, { recursive: true, force: true }))
  const buffer = Buffer.from('%PDF-1.7 contract')

  const saved = await saveAttachmentFile({ originalname: '合同.pdf', mimetype: 'application/pdf', size: buffer.length, buffer }, rootDir)
  assert.match(saved.storageName, /^[a-f0-9-]+\.pdf$/)
  assert.deepEqual(await fsp.readFile(saved.filePath), buffer)
  await removeAttachmentFile(saved.storageName, rootDir)
  await assert.rejects(fsp.access(saved.filePath))
  await assert.rejects(removeAttachmentFile('../outside.pdf', rootDir), /文件路径不合法/)
})
