const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { cachedOpenUpload } = require('../src/services/openAttachmentStore')
test('附件上传回执持久化，业务失败后的重试不重复上传，同内容不同系统隔离',async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'sidm-open-receipt-test-'))
  let calls=0
  const upload = async () => { calls++;return {storageName:'pmis/test.txt',ossResponse:{data:[{id:'x',fileName:'test.txt',filePath:'pmis/test.txt',fileUrl:'http://oss.znjs.com:9000/pmis/test.txt'}]}} }
  try {
    const context={client:{id:1},digest:'abc'}
    const first=await cachedOpenUpload({},context,{root,upload})
    assert.deepEqual(await cachedOpenUpload({},context,{root,upload}),first)
    assert.equal(calls,1)
    await cachedOpenUpload({},{...context,client:{id:2}},{root,upload})
    assert.equal(calls,2)
    for (const name of await fs.readdir(root)) assert.equal((await fs.stat(path.join(root,name))).mode & 0o777,0o600)
  } finally {await fs.rm(root,{recursive:true,force:true})}
})
test('损坏回执作为缓存失效自动恢复',async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'sidm-open-receipt-recovery-'))
  let calls=0
  const context={client:{id:1},digest:'broken'}
  const upload=async () => {calls++;return {storageName:'pmis/recovered.txt',ossResponse:{data:[{id:'x',fileName:'recovered.txt',filePath:'pmis/recovered.txt',fileUrl:'http://oss.znjs.com:9000/pmis/recovered.txt'}]}}}
  try {
    await fs.writeFile(path.join(root,require('node:crypto').createHash('sha256').update('1:broken').digest('hex')+'.json'),'{broken')
    const result=await cachedOpenUpload({},context,{root,upload})
    assert.equal(result.storageName,'pmis/recovered.txt')
    assert.equal(calls,1)
  } finally {await fs.rm(root,{recursive:true,force:true})}
})
test('同一附件并发重试只调用一次存储',async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'sidm-open-receipt-concurrency-'))
  let calls=0
  const context={client:{id:1},digest:'same'}
  const receipt={storageName:'pmis/same.txt',ossResponse:{data:[{id:'x',fileName:'same.txt',filePath:'pmis/same.txt',fileUrl:'http://oss.znjs.com:9000/pmis/same.txt'}]}}
  const upload=async () => {calls++;await new Promise((resolve)=>setTimeout(resolve,20));return receipt}
  try {
    const results=await Promise.all([cachedOpenUpload({},context,{root,upload}),cachedOpenUpload({},context,{root,upload})])
    assert.deepEqual(results,[receipt,receipt])
    assert.equal(calls,1)
  } finally {await fs.rm(root,{recursive:true,force:true})}
})
