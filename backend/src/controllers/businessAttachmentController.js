const { Readable } = require('node:stream')
const db = require('../db')
const { ok, fail } = require('../utils/response')
const {
  deleteBusinessAttachment,
  findBusinessAttachment,
  getBusinessConfig,
  listBusinessAttachments,
  loadOssAttachment,
  uploadBusinessAttachment,
} = require('../services/businessAttachmentService')

function respondError(res, error, fallback) {
  if (error.statusCode) return fail(res, error.statusCode, error.statusCode, error.message)
  console.error(error)
  return fail(res, 500, 500, fallback)
}

function createBusinessAttachmentController(businessType) {
  getBusinessConfig(businessType)
  return {
    list: async (req, res) => {
      try {
        ok(res, await listBusinessAttachments(db, businessType, req.params.id))
      } catch (error) {
        respondError(res, error, '附件加载失败')
      }
    },
    upload: async (req, res) => {
      try {
        ok(res, await uploadBusinessAttachment(businessType, req.params.id, req.file, req.user.id))
      } catch (error) {
        respondError(res, error, '附件上传失败')
      }
    },
    download: async (req, res) => {
      try {
        const attachment = await findBusinessAttachment(db, businessType, req.params.id, req.params.attachmentId)
        if (!attachment) return fail(res, 404, 404, '附件不存在')
        const response = await loadOssAttachment(attachment.oss_response)
        res.setHeader('Content-Type', attachment.mime_type)
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(attachment.original_name)}`)
        Readable.fromWeb(response.body).pipe(res)
      } catch (error) {
        respondError(res, error, '附件下载失败')
      }
    },
    remove: async (req, res) => {
      try {
        await deleteBusinessAttachment(db, businessType, req.params.id, req.params.attachmentId, req.user.id)
        ok(res, null)
      } catch (error) {
        respondError(res, error, '附件删除失败')
      }
    },
  }
}

module.exports = { createBusinessAttachmentController }
