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

test('业务附件支持真实 PPT 和 PPTX 文件，不接受仅改扩展名的伪装文件', () => {
  const { validateAttachmentFile } = require(servicePath)
  const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00])
  const zip = Buffer.from('PK\u0003\u0004presentation')

  assert.deepEqual(validateAttachmentFile({
    originalname: '汇报材料.ppt',
    mimetype: 'application/vnd.ms-powerpoint',
    size: ole.length,
    buffer: ole,
  }), { extension: '.ppt' })
  assert.deepEqual(validateAttachmentFile({
    originalname: '汇报材料.pptx',
    mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    size: zip.length,
    buffer: zip,
  }), { extension: '.pptx' })
  assert.throws(() => validateAttachmentFile({
    originalname: '伪装材料.pptx',
    mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    size: 4,
    buffer: Buffer.from('MZ00'),
  }), /文件内容与类型不匹配/)
})

test('合法附件允许浏览器使用通用或压缩包 MIME，但仍校验文件内容', () => {
  const { validateAttachmentFile } = require(servicePath)
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
  const pptx = Buffer.from('PK\u0003\u0004presentation')

  assert.deepEqual(validateAttachmentFile({
    originalname: '截图.png',
    mimetype: 'application/octet-stream',
    size: png.length,
    buffer: png,
  }), { extension: '.png' })
  assert.deepEqual(validateAttachmentFile({
    originalname: '汇报材料.pptx',
    mimetype: 'application/zip',
    size: pptx.length,
    buffer: pptx,
  }), { extension: '.pptx' })
  assert.throws(() => validateAttachmentFile({
    originalname: '伪装材料.pptx',
    mimetype: 'application/zip',
    size: 4,
    buffer: Buffer.from('MZ00'),
  }), /文件内容与类型不匹配/)
})

test('受支持图片的文件名后缀写错时按真实图片格式纠正', () => {
  const { validateAttachmentFile } = require(servicePath)
  const webp = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x10, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP'),
    Buffer.from('VP8 '),
  ])

  assert.deepEqual(validateAttachmentFile({
    originalname: '测试3.png',
    mimetype: 'image/png',
    size: webp.length,
    buffer: webp,
  }), {
    extension: '.webp',
    mimetype: 'image/webp',
    originalname: '测试3.webp',
  })

  assert.deepEqual(validateAttachmentFile({
    originalname: '测试3.png',
    mimetype: 'image/webp',
    size: webp.length,
    buffer: webp,
  }), {
    extension: '.webp',
    mimetype: 'image/webp',
    originalname: '测试3.webp',
  })
})

test('业务附件支持 TXT 和 Markdown 文本文件并拒绝伪装二进制内容', () => {
  const { validateAttachmentFile } = require(servicePath)
  const text = Buffer.from('项目说明\n支持中文内容', 'utf8')
  const markdown = Buffer.from('# 项目说明\n\n- 待办事项', 'utf8')

  assert.deepEqual(validateAttachmentFile({
    originalname: '项目说明.txt',
    mimetype: 'text/plain',
    size: text.length,
    buffer: text,
  }), { extension: '.txt' })
  assert.deepEqual(validateAttachmentFile({
    originalname: '项目说明.md',
    mimetype: 'application/octet-stream',
    size: markdown.length,
    buffer: markdown,
  }), { extension: '.md' })
  assert.throws(() => validateAttachmentFile({
    originalname: '伪装说明.md',
    mimetype: 'text/plain',
    size: 5,
    buffer: Buffer.from([0x00, 0xff, 0x00, 0xfe, 0x01]),
  }), /文件内容与类型不匹配/)
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
