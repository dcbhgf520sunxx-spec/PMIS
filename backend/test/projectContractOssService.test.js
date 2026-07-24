const test = require('node:test')
const assert = require('node:assert/strict')

const {
  OSS_BUCKET_NAME,
  resolveOssFile,
  uploadAttachmentToOss,
} = require('../src/services/projectContractOssService')

const ossResponse = {
  code: 100,
  msg: 'success',
  data: [{
    id: '2080462181968818177',
    fileName: '合同附件.pdf',
    fileUrl: 'http://oss.znjs.com:9000/pmis/20260724/contract.pdf',
    fileSize: '21 B',
    filePath: '20260724/contract.pdf',
    fileExtName: 'pdf',
  }],
}

test('合同附件上传固定使用小写 pmis bucket 并保留完整 OSS 响应', async () => {
  let request
  const fetchImpl = async (url, options) => {
    request = { url, options }
    return new Response(JSON.stringify(ossResponse), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  const buffer = Buffer.from('%PDF-1.7 contract')

  const saved = await uploadAttachmentToOss({
    originalname: '合同附件.pdf',
    mimetype: 'application/pdf',
    size: buffer.length,
    buffer,
  }, { fetchImpl })

  assert.equal(OSS_BUCKET_NAME, 'pmis')
  assert.equal(request.options.method, 'POST')
  assert.equal(request.options.body.get('bucketName'), 'pmis')
  assert.equal(request.options.body.get('file').name, '合同附件.pdf')
  assert.deepEqual(saved.ossResponse, ossResponse)
  assert.equal(saved.storageName, '20260724/contract.pdf')
  assert.deepEqual(saved.file, ossResponse.data[0])
})

test('合同附件上传拒绝 OSS 空数据和失败响应', async () => {
  const file = {
    originalname: '合同附件.pdf',
    mimetype: 'application/pdf',
    size: 17,
    buffer: Buffer.from('%PDF-1.7 contract'),
  }

  await assert.rejects(
    uploadAttachmentToOss(file, {
      fetchImpl: async () => new Response('{"code":100,"msg":"success","data":[]}', { status: 200 }),
    }),
    /未返回文件信息/
  )
  await assert.rejects(
    uploadAttachmentToOss(file, {
      fetchImpl: async () => new Response('bad gateway', { status: 502 }),
    }),
    /OSS 上传失败/
  )
})

test('合同附件只代理 pmis bucket 中的可信 OSS 地址', () => {
  assert.deepEqual(resolveOssFile(ossResponse), ossResponse.data[0])
  assert.throws(
    () => resolveOssFile({ ...ossResponse, data: [{ ...ossResponse.data[0], fileUrl: 'http://example.com/file.pdf' }] }),
    /文件地址不合法/
  )
  assert.throws(
    () => resolveOssFile({ ...ossResponse, data: [] }),
    /文件信息不存在/
  )
})
