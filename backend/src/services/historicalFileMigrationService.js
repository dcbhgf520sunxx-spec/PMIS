const crypto = require('node:crypto')

const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
}

function migrationError(message) {
  const error = new Error(message)
  error.code = 'FILE_MIGRATION_INVALID'
  return error
}

function toImageFile(mimeType, base64, index) {
  const normalizedMime = String(mimeType || '').toLowerCase()
  const extension = MIME_EXTENSIONS[normalizedMime]
  if (!extension) throw migrationError(`不支持迁移该内嵌图片类型：${mimeType}`)
  const value = String(base64 || '').replace(/\s+/g, '')
  if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw migrationError('内嵌图片Base64格式无效')
  }
  const buffer = Buffer.from(value, 'base64')
  if (!buffer.length) throw migrationError('内嵌图片内容为空')
  return {
    originalname: `rich-text-${index}-${crypto.randomUUID()}${extension}`,
    mimetype: normalizedMime,
    size: buffer.length,
    buffer,
  }
}

async function migrateRichTextDataImages(value, { uploadImage }) {
  const html = String(value || '')
  const pattern = /(<img\b[^>]*\bsrc\s*=\s*)(["'])data:(image\/(?:jpeg|png|gif|webp));base64,([^"']+)\2/gi
  const matches = [...html.matchAll(pattern)]
  if (!matches.length) return { value: html, migratedCount: 0 }

  let migrated = html
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index]
    const file = toImageFile(match[3], match[4], index + 1)
    const uploaded = await uploadImage(file)
    if (!uploaded?.url) throw migrationError('OSS上传未返回图片URL')
    const replacement = `${match[1]}${match[2]}${uploaded.url}${match[2]}`
    migrated = `${migrated.slice(0, match.index)}${replacement}${migrated.slice(match.index + match[0].length)}`
  }
  return { value: migrated, migratedCount: matches.length }
}

module.exports = {
  migrateRichTextDataImages,
  toImageFile,
}
