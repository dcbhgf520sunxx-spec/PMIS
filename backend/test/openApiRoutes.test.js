const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const { createOpenApiRouter, classifyDownloadError } = require('../src/routes/openApi')

test('鉴权失败也返回可追踪的 requestId', async () => {
  const app=express()
  app.use(express.json())
  app.use('/api/open/v1',createOpenApiRouter({service:{authenticate:async()=>{const e=new Error('访问凭证无效');e.statusCode=401;throw e}}}))
  const server=app.listen(0,'127.0.0.1')
  await new Promise((resolve)=>server.once('listening',resolve))
  try {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/open/v1/health`,{headers:{authorization:'Bearer invalid'}})
    const body=await response.json()
    assert.equal(response.status,401)
    assert.match(body.requestId,/^[0-9a-f-]{36}$/)
    assert.equal(response.headers.get('x-request-id'),body.requestId)
  } finally {server.closeAllConnections();await new Promise((resolve)=>server.close(resolve))}
})

test('附件下载区分客户端中断和存储失败',() => {
  assert.deepEqual(classifyDownloadError(Object.assign(new Error('closed'),{code:'ERR_STREAM_PREMATURE_CLOSE'}),{}),{status:499,message:'客户端中断附件下载'})
  assert.deepEqual(classifyDownloadError(new Error('oss'),{}),{status:502,message:'附件下载失败'})
})

test('路由层参数错误也返回同一追踪号',async () => {
  const app=express()
  app.use(express.json())
  app.use('/api/open/v1',createOpenApiRouter({service:{authenticate:async()=>({id:1})}}))
  const server=app.listen(0,'127.0.0.1')
  await new Promise((resolve)=>server.once('listening',resolve))
  try {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/open/v1/requirements/operate`,{method:'POST',headers:{authorization:'Bearer token','content-type':'application/json'},body:JSON.stringify({operation:'UNKNOWN'})})
    const body=await response.json()
    assert.equal(response.status,400)
    assert.equal(response.headers.get('x-request-id'),body.requestId)
  } finally {server.closeAllConnections();await new Promise((resolve)=>server.close(resolve))}
})
