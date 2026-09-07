const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { PRIVATE_ATTACHMENT_DIR } = require('./projectContractAttachmentService')
const { uploadAttachmentToOss, resolveOssFile } = require('./projectContractOssService')

const pendingUploads = new Map()

// 在数据库失败后的重试中复用已上传文件。仅保存 OSS 回执，不保存文件正文和凭证。
async function cachedOpenUpload(file, context, { root = path.join(path.dirname(PRIVATE_ATTACHMENT_DIR),'open-api-receipts'), upload = uploadAttachmentToOss } = {}) {
  const key = crypto.createHash('sha256').update(`${context.client.id}:${context.digest}`).digest('hex')
  const target = path.join(root,`${key}.json`)
  try {
    const stored = JSON.parse(await fs.readFile(target,'utf8'))
    resolveOssFile(stored.ossResponse)
    return stored
  } catch (e) {
    if (e.code !== 'ENOENT') await fs.rm(target,{force:true})
  }
  if (pendingUploads.has(target)) return pendingUploads.get(target)
  const pending = (async () => {
    await fs.mkdir(root,{recursive:true,mode:0o700})
    const saved = await upload(file,{ fetchImpl:(url,options) => fetch(url,{...options,signal:AbortSignal.timeout(30000)}) })
    const temp = `${target}.${crypto.randomUUID()}.tmp`
    await fs.writeFile(temp,JSON.stringify(saved),{mode:0o600,flag:'wx'})
    await fs.rename(temp,target)
    return saved
  })()
  pendingUploads.set(target,pending)
  try { return await pending } finally { pendingUploads.delete(target) }
}
module.exports = { cachedOpenUpload }
