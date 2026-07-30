const path = require('node:path')
const { uploadFileToOss } = require('./projectContractOssService')
const { createOssAccessUrl } = require('./ossFileUrlService')

const MAX_RICH_TEXT_IMAGE_SIZE = 5 * 1024 * 1024
const imageRules = {
  '.jpg': {
    mimes: ['image/jpeg'],
    signature: (buffer) => buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  },
  '.jpeg': {
    mimes: ['image/jpeg'],
    signature: (buffer) => buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  },
  '.png': {
    mimes: ['image/png', 'image/x-png'],
    signature: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  '.gif': {
    mimes: ['image/gif'],
    signature: (buffer) => ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString()),
  },
  '.webp': {
    mimes: ['image/webp'],
    signature: (buffer) => buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP',
  },
}

function imageError(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function validateRichTextImage(file = {}) {
  const buffer = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.alloc(0)
  if (!buffer.length) throw imageError('图片内容不能为空')
  if (buffer.length > MAX_RICH_TEXT_IMAGE_SIZE) throw imageError('图片不能超过5MB')
  const extension = path.extname(String(file.originalname || '')).toLowerCase()
  const rule = imageRules[extension]
  if (!rule || !rule.mimes.includes(String(file.mimetype || '').toLowerCase())) {
    throw imageError('富文本图片仅支持 JPG、PNG、GIF、WEBP 格式')
  }
  if (!rule.signature(buffer)) throw imageError('图片内容与类型不匹配')
}

async function uploadRichTextImageToOss(file, options = {}) {
  const { accessUrlOptions, ...uploadOptions } = options
  const saved = await uploadFileToOss(file, {
    ...uploadOptions,
    validateFile: validateRichTextImage,
  })
  return {
    url: createOssAccessUrl({
      filePath: saved.file.filePath,
      fileName: file.originalname,
    }, {
      ...accessUrlOptions,
      expiresInSeconds: 0,
    }),
    ossResponse: saved.ossResponse,
  }
}

module.exports = {
  MAX_RICH_TEXT_IMAGE_SIZE,
  uploadRichTextImageToOss,
  validateRichTextImage,
}
