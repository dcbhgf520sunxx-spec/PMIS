const { Readable } = require('node:stream')
const { fail } = require('../utils/response')
const { OSS_FILE_ORIGIN } = require('../services/projectContractOssService')
const { verifyOssAccessRequest } = require('../services/ossFileUrlService')

exports.read = async (req, res) => {
  try {
    const { filePath, fileName } = verifyOssAccessRequest(req.query)
    const upstream = await fetch(new URL(`/${filePath}`, OSS_FILE_ORIGIN), {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })
    if (!upstream.ok || !upstream.body) return fail(res, 404, 404, '文件不存在')
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`)
    res.setHeader('Cache-Control', 'private, max-age=300')
    Readable.fromWeb(upstream.body).pipe(res)
  } catch (error) {
    if (error.statusCode === 403) return fail(res, 403, 403, error.message)
    console.error(error)
    return fail(res, 500, 500, '读取OSS文件失败')
  }
}
