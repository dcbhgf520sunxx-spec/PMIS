const multer = require('multer')
const { fail } = require('../utils/response')
const { MAX_RICH_TEXT_IMAGE_SIZE } = require('../services/richTextImageOssService')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RICH_TEXT_IMAGE_SIZE },
})

function uploadRichTextImage(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next()
    if (error.code === 'LIMIT_FILE_SIZE') return fail(res, 400, 400, '图片不能超过5MB')
    return fail(res, 400, 400, '富文本图片上传失败')
  })
}

module.exports = { uploadRichTextImage }
