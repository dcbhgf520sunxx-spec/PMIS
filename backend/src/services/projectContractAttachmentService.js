const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')

const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024
const PRIVATE_ATTACHMENT_DIR = path.join(__dirname, '../../private-uploads/project-contracts')

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
  ['.zip', { mimes: ['application/zip', 'application/x-zip-compressed'], signature: hasZipSignature }],
])

function hasZipSignature(buffer) {
  return buffer.subarray(0, 2).toString() === 'PK'
}

function hasOleSignature(buffer) {
  return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
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
  if (!rule || !rule.mimes.includes(String(file.mimetype || '').toLowerCase())) throw attachmentError('不支持该文件类型')
  if (!rule.signature(buffer)) throw attachmentError('文件内容与类型不匹配')
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
  normalizeOriginalName,
  removeAttachmentFile,
  resolveAttachmentPath,
  saveAttachmentFile,
  validateAttachmentFile,
}
