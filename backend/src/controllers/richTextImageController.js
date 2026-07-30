const { fail, ok } = require('../utils/response')
const { normalizeOriginalName } = require('../services/projectContractAttachmentService')
const { uploadRichTextImageToOss } = require('../services/richTextImageOssService')

exports.upload = async (req, res) => {
  try {
    if (!req.file) return fail(res, 400, 400, '请选择要上传的图片')
    req.file.originalname = normalizeOriginalName(req.file.originalname)
    const saved = await uploadRichTextImageToOss(req.file)
    ok(res, { url: saved.url })
  } catch (error) {
    if (error.statusCode === 400) return fail(res, 400, 400, error.message)
    console.error(error)
    return fail(res, 500, 500, '富文本图片上传失败')
  }
}
