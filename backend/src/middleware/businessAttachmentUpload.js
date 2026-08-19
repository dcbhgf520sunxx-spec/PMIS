const multer = require('multer')
const { MAX_ATTACHMENT_SIZE } = require('../services/projectContractAttachmentService')
const { fail } = require('../utils/response')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_ATTACHMENT_SIZE } })

function uploadBusinessAttachment(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next()
    if (error.code === 'LIMIT_FILE_SIZE') return fail(res, 400, 400, '单个附件不能超过20MB')
    return fail(res, 400, 400, '附件上传失败')
  })
}

module.exports = { uploadBusinessAttachment }
