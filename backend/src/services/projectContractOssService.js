const { validateAttachmentFile } = require('./projectContractAttachmentService')

const OSS_UPLOAD_URL = process.env.CONTRACT_ATTACHMENT_OSS_UPLOAD_URL || 'http://oss.znjs.com:8401/oss/file/upload'
const OSS_FILE_ORIGIN = process.env.CONTRACT_ATTACHMENT_OSS_FILE_ORIGIN || 'http://oss.znjs.com:9000'
const OSS_BUCKET_NAME = 'pmis'

function ossError(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function resolveOssFile(value) {
  let payload = value
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload)
    } catch {
      throw ossError('OSS 文件信息不存在')
    }
  }
  const file = payload?.data?.[0]
  if (!file?.id || !file?.fileName || !file?.filePath || !file?.fileUrl) {
    throw ossError('OSS 文件信息不存在')
  }
  let url
  try {
    url = new URL(file.fileUrl)
  } catch {
    throw ossError('OSS 文件地址不合法')
  }
  const allowedOrigin = new URL(OSS_FILE_ORIGIN).origin
  if (url.origin !== allowedOrigin || !url.pathname.startsWith(`/${OSS_BUCKET_NAME}/`)) {
    throw ossError('OSS 文件地址不合法')
  }
  return file
}

async function uploadAttachmentToOss(file, { fetchImpl = fetch, uploadUrl = OSS_UPLOAD_URL } = {}) {
  validateAttachmentFile(file)
  const form = new FormData()
  form.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname)
  form.append('bucketName', OSS_BUCKET_NAME)

  let response
  try {
    response = await fetchImpl(uploadUrl, { method: 'POST', body: form })
  } catch {
    throw ossError('OSS 上传失败，请稍后重试')
  }
  if (!response.ok) throw ossError('OSS 上传失败，请稍后重试')

  let payload
  try {
    payload = await response.json()
  } catch {
    throw ossError('OSS 上传返回格式不正确')
  }
  if (payload?.code !== 100) throw ossError(payload?.msg || 'OSS 上传失败，请稍后重试')
  if (!Array.isArray(payload.data) || !payload.data.length) throw ossError('OSS 上传未返回文件信息')

  const storedFile = resolveOssFile(payload)
  return {
    file: storedFile,
    ossResponse: payload,
    storageName: storedFile.filePath,
  }
}

async function loadOssAttachment(ossResponse, { fetchImpl = fetch } = {}) {
  const file = resolveOssFile(ossResponse)
  let response
  try {
    response = await fetchImpl(file.fileUrl)
  } catch {
    throw ossError('读取 OSS 附件失败')
  }
  if (!response.ok || !response.body) throw ossError('OSS 附件不存在或暂时无法读取')
  return response
}

module.exports = {
  OSS_BUCKET_NAME,
  OSS_FILE_ORIGIN,
  OSS_UPLOAD_URL,
  loadOssAttachment,
  resolveOssFile,
  uploadAttachmentToOss,
}
