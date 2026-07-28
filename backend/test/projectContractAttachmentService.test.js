const test = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
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

test('生产环境合同附件和交付文件统一写入显式共享根目录', async (t) => {
  const fsp = require('node:fs/promises')
  const sharedRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'pmis-private-uploads-'))
  t.after(() => fsp.rm(sharedRoot, { recursive: true, force: true }))
  const script = `
    const fs = require('node:fs/promises')
    const service = require(${JSON.stringify(servicePath)})
    const buffer = Buffer.from('%PDF-1.7 contract')
    service.saveAttachmentFile({
      originalname: '合同.pdf',
      mimetype: 'application/pdf',
      size: buffer.length,
      buffer
    }).then((saved) => {
      process.stdout.write(JSON.stringify({
        privateAttachmentDir: service.PRIVATE_ATTACHMENT_DIR,
        projectPlanDeliveryDir: service.PROJECT_PLAN_DELIVERY_DIR,
        savedFilePath: saved.filePath
      }))
    })
  `
  const result = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
    env: { ...process.env, PMIS_PRIVATE_UPLOAD_ROOT: sharedRoot },
  })

  assert.equal(result.status, 0, result.stderr)
  const output = JSON.parse(result.stdout)
  assert.equal(output.privateAttachmentDir, path.join(sharedRoot, 'project-contracts'))
  assert.equal(output.projectPlanDeliveryDir, path.join(sharedRoot, 'project-plan-deliveries'))
  assert.equal(path.dirname(output.savedFilePath), path.join(sharedRoot, 'project-contracts'))
  assert.deepEqual(await fsp.readFile(output.savedFilePath), Buffer.from('%PDF-1.7 contract'))
})
