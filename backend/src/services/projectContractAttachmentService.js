const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { TextDecoder } = require('node:util')

const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024
const PRIVATE_UPLOAD_ROOT = path.resolve(process.env.PMIS_PRIVATE_UPLOAD_ROOT || path.join(__dirname, '../../private-uploads'))
const PRIVATE_ATTACHMENT_DIR = path.join(PRIVATE_UPLOAD_ROOT, 'project-contracts')
const PROJECT_PLAN_DELIVERY_DIR = path.join(PRIVATE_UPLOAD_ROOT, 'project-plan-deliveries')

const typeRules = new Map([
  ['.jpg', { mimes: ['image/jpeg'], signature: (buffer) => buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) }],
  ['.jpeg', { mimes: ['image/jpeg'], signature: (buffer) => buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) }],
  ['.png', { mimes: ['image/png'], signature: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) }],
  ['.webp', { mimes: ['image/webp'], signature: (buffer) => buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP' }],
  ['.pdf', { mimes: ['application/pdf'], signature: (buffer) => buffer.subarray(0, 5).toString() === '%PDF-' }],
  ['.doc', { mimes: ['application/msword'], signature: hasOleSignature }],
  ['.xls', { mimes: ['application/vnd.ms-excel'], signature: hasOleSignature }],
  ['.docx', { mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], signature: hasZipSignature }],
  ['.xlsx', { mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], signature: hasZipSignature }],
  ['.ppt', { mimes: ['application/vnd.ms-powerpoint'], signature: hasOleSignature }],
  ['.pptx', { mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'], signature: hasZipSignature }],
  ['.txt', { mimes: ['text/plain'], signature: hasUtf8TextSignature }],
  ['.md', { mimes: ['text/markdown', 'text/x-markdown', 'text/plain'], signature: hasUtf8TextSignature }],
  ['.zip', { mimes: ['application/zip', 'application/x-zip-compressed'], signature: hasZipSignature }],
])
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp']

function hasZipSignature(buffer) {
  return buffer.subarray(0, 2).toString() === 'PK'
}

function hasOleSignature(buffer) {
  return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
}

function hasUtf8TextSignature(buffer) {
  if (buffer.includes(0)) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    return true
  } catch {
    return false
  }
}

function attachmentError(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function normalizeOriginalName(value) {
  const originalName = String(value || '')
  const decoded = Buffer.from(originalName, 'latin1').toString('utf8')
  return decoded.includes('\uFFFD') ? originalName : decoded
}

function validateAttachmentFile(file = {}) {
  const originalName = String(file.originalname || '')
  const buffer = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.alloc(0)
  const size = Math.max(buffer.length, Number(file.size || 0))
  if (!originalName || originalName.length > 255) throw attachmentError('文件名不能为空且不能超过255个字符')
  if (size <= 0) throw attachmentError('附件内容不能为空')
  if (size > MAX_ATTACHMENT_SIZE) throw attachmentError('单个附件不能超过20MB')
  const extension = path.extname(originalName).toLowerCase()
  const rule = typeRules.get(extension)
  const mime = String(file.mimetype || '').toLowerCase()
  const genericMimes = ['', 'application/octet-stream']
  const zipMimes = ['application/zip', 'application/x-zip-compressed']
  const isOfficeZip = ['.docx', '.xlsx', '.pptx'].includes(extension)
  if (imageExtensions.includes(extension)) {
    const actualExtension = imageExtensions.find((candidate) => typeRules.get(candidate).signature(buffer))
    if (actualExtension) {
      const actualRule = typeRules.get(actualExtension)
      const correctedExtension = actualExtension === '.jpeg' ? '.jpg' : actualExtension
      if (correctedExtension !== extension || (!actualRule.mimes.includes(mime) && !genericMimes.includes(mime))) {
        return {
          extension: correctedExtension,
          mimetype: actualRule.mimes[0],
          originalname: `${originalName.slice(0, -extension.length)}${correctedExtension}`,
        }
      }
    }
  }
  const mimeMatches = rule && (
    rule.mimes.includes(mime)
    || genericMimes.includes(mime)
    || (isOfficeZip && zipMimes.includes(mime))
  )
  if (!mimeMatches) throw attachmentError(`不支持该文件类型：${originalName}`)
  if (!rule.signature(buffer)) {
    throw attachmentError(`文件内容与类型不匹配：${originalName}`)
  }
  return { extension }
}

function resolveAttachmentPath(storageName, rootDir = PRIVATE_ATTACHMENT_DIR) {
  if (!/^[a-f0-9-]+\.[a-z0-9]+$/.test(String(storageName || '')) || path.basename(storageName) !== storageName) {
    throw attachmentError('文件路径不合法')
  }
  return path.join(rootDir, storageName)
}

async function saveAttachmentFile(file, rootDir = PRIVATE_ATTACHMENT_DIR) {
  const { extension } = validateAttachmentFile(file)
  await fs.mkdir(rootDir, { recursive: true })
  const storageName = `${crypto.randomUUID()}${extension}`
  const filePath = resolveAttachmentPath(storageName, rootDir)
  await fs.writeFile(filePath, file.buffer, { flag: 'wx' })
  return { storageName, filePath }
}

async function removeAttachmentFile(storageName, rootDir = PRIVATE_ATTACHMENT_DIR) {
  const filePath = resolveAttachmentPath(storageName, rootDir)
  await fs.unlink(filePath).catch((error) => {
    if (error.code !== 'ENOENT') throw error
  })
}

module.exports = {
  MAX_ATTACHMENT_SIZE,
  PRIVATE_ATTACHMENT_DIR,
  PROJECT_PLAN_DELIVERY_DIR,
  normalizeOriginalName,
  removeAttachmentFile,
  resolveAttachmentPath,
  saveAttachmentFile,
  validateAttachmentFile,
}
