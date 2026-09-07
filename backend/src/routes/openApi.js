const express = require('express')
const crypto = require('node:crypto')
const multer = require('multer')
const { Readable } = require('node:stream')
const { pipeline } = require('node:stream/promises')
const { createOpenApiService } = require('../services/openApiService')
const { loadOssAttachment } = require('../services/businessAttachmentService')
const { MAX_ATTACHMENT_SIZE } = require('../services/projectContractAttachmentService')

function classifyDownloadError(error,res) {
  const clientAborted = res.destroyed || ['ERR_STREAM_PREMATURE_CLOSE','ECONNRESET'].includes(error?.code)
  return clientAborted
    ? {status:499,message:'客户端中断附件下载'}
    : {status:502,message:'附件下载失败'}
}

function createOpenApiRouter({ service = createOpenApiService(), download = (receipt) => loadOssAttachment(receipt,{fetchImpl:(url) => fetch(url,{signal:AbortSignal.timeout(30000)})}) } = {}) {
  const router = express.Router()
  const token = (req) => /^Bearer ([^\s]+)$/.exec(req.get('authorization') || '')?.[1]
  const send = (res,result) => { res.setHeader('x-request-id',result.requestId); return res.status(result.code === 0 ? 200 : result.code).json(result) }
  const upload = multer({ storage:multer.memoryStorage(), limits:{ fileSize:MAX_ATTACHMENT_SIZE, files:1, fields:3, fieldSize:1024 } }).single('file')
  // 独立系统凭证鉴权：在 multipart 解析前拒绝无效凭证。
  router.use(async (req,res,next) => {
    req.openRequestId = crypto.randomUUID()
    res.setHeader('x-request-id',req.openRequestId)
    try { await service.authenticate(token(req)); next() }
    catch (e) { res.status(e.statusCode || 500).json({code:e.statusCode || 500,message:e.statusCode ? e.message : '鉴权失败',data:null,requestId:req.openRequestId}) }
  })
  router.get('/health',async (req,res) => send(res,await service.systemQuery(token(req),'HEALTH',undefined,[],req.openRequestId)))
  router.get('/reference-data',async (req,res) => send(res,await service.systemQuery(token(req),'REFERENCE_DATA',req.query.operatorEmployeeNo,String(req.query.types || '').split(',').filter(Boolean),req.openRequestId)))
  for (const [url,resource] of [['requirements','requirement'],['work-orders','work_order']]) {
    router.post(`/${url}/operate`,async (req,res) => {
      if (!['QUERY','CREATE','UPDATE','DELETE','CHANGE_STATUS','CHANGE_PRIORITY'].includes(req.body?.operation)) return res.status(400).json({code:400,message:'operation 不正确',data:null,requestId:req.openRequestId})
      send(res,await service.operate(token(req),resource,req.body,{ip:req.ip,requestId:req.openRequestId}))
    })
    const attachmentInput = (req,op) => ({ ...req.body,operation:op,sourceRecordId:req.params.sourceRecordId,
      operatorEmployeeNo:req.method === 'GET' ? req.query.operatorEmployeeNo : req.body?.operatorEmployeeNo })
    router.get(`/${url}/:sourceRecordId/attachments`,async (req,res) => send(res,await service.operate(token(req),resource,attachmentInput(req,'ATTACHMENT_LIST'),{ip:req.ip,requestId:req.openRequestId})))
    router.post(`/${url}/:sourceRecordId/attachments`,(req,res,next) => upload(req,res,(e) => {
      if (e) return res.status(e.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({code:e.code === 'LIMIT_FILE_SIZE' ? 413 : 400,message:e.code === 'LIMIT_FILE_SIZE' ? '单个附件不能超过20MB' : '附件请求格式不正确',data:null,requestId:req.openRequestId})
      next()
    }),async (req,res) => send(res,await service.operate(token(req),resource,attachmentInput(req,'ATTACHMENT_UPLOAD'),{file:req.file,ip:req.ip,requestId:req.openRequestId})))
    router.post(`/${url}/:sourceRecordId/attachments/delete`,async (req,res) => {
      const b = { ...req.body }
      const attachmentId = b.attachmentId
      delete b.attachmentId
      send(res,await service.operate(token(req),resource,{...b,operation:'ATTACHMENT_DELETE',sourceRecordId:req.params.sourceRecordId,data:{attachmentId}},{ip:req.ip,requestId:req.openRequestId}))
    })
    router.get(`/${url}/:sourceRecordId/attachments/:attachmentId/download`,async (req,res) => {
      const result = await service.operate(token(req),resource,{...attachmentInput(req,'ATTACHMENT_DOWNLOAD'),data:{attachmentId:Number(req.params.attachmentId)}},{ip:req.ip,requestId:req.openRequestId})
      if (result.code) return send(res,result)
      try {
        const attachment = result.data.attachment
        const response = await download(attachment.oss_response)
        res.setHeader('x-request-id',result.requestId)
        res.setHeader('Content-Type',attachment.mime_type)
        res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(attachment.original_name)}`)
        await pipeline(Readable.fromWeb(response.body),res)
      } catch (error) {
        const failure = classifyDownloadError(error,res)
        await service.recordDownloadFailure(result.requestId,failure).catch(() => console.error('开放接口下载失败日志写入失败',result.requestId))
        if (!res.headersSent && !res.destroyed) res.status(failure.status).json({code:failure.status,message:failure.message,data:null,requestId:result.requestId})
      }
    })
  }
  return router
}
module.exports = createOpenApiRouter()
module.exports.createOpenApiRouter = createOpenApiRouter
module.exports.classifyDownloadError = classifyDownloadError
