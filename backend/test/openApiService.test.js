const test = require('node:test')
const assert = require('node:assert/strict')
const { createOpenApiService } = require('../src/services/openApiService')
const { hash } = require('../src/services/openApiContract')

test('附件存储调用不占用数据库事务',async () => {
  const token=`sidm_open_${'a'.repeat(43)}`
  let inTransaction=false
  const client={id:1,enabled:1,token_hash:hash(token),expires_at:null}
  const user={id:2,employee_no:'EMP001',real_name:'张三'}
  const attachment={id:9,business_type:'requirement',business_id:7,original_name:'a.txt',mime_type:'text/plain',file_size:1,sort_order:0,creator_id:2,updater_id:2,created_at:'2026-09-07',updated_at:'2026-09-07'}
  const connection={
    query:async()=>{},
    writeLog:async()=>{},
    prepare(sql){
      return {
        get:async (..._args) => {
          if (sql.includes('FROM pms_open_client WHERE token_hash')) return client
          if (sql.includes('FROM pms_open_client WHERE id')) return client
          if (sql.includes('FROM pms_user WHERE employee_no')) return user
          if (sql.includes('FROM pms_open_request')) return undefined
          if (sql.includes('FROM pms_open_record')) return {client_id:1,resource_type:'requirement',source_record_id:'REQ-1',target_id:7}
          if (sql.includes('FROM pms_requirement WHERE id') && sql.includes('FOR UPDATE')) return {id:7,is_deleted:0}
          if (sql.includes('FROM pms_requirement WHERE id')) return {id:7,is_deleted:0}
          if (sql.includes('COUNT(*) total FROM pms_business_attachment')) return {total:0}
          if (sql.includes('SELECT * FROM pms_business_attachment')) return attachment
          return undefined
        },
        all:async () => sql.includes('SELECT DISTINCT m.path') ? [{path:'/requirements'}] : [],
        run:async () => sql.includes('INSERT INTO pms_business_attachment') ? {lastInsertRowid:9} : {changes:1},
      }
    },
  }
  const db={...connection,transaction:async (work) => {
    inTransaction=true
    try { return await work(connection) } finally { inTransaction=false }
  }}
  const service=createOpenApiService({db,upload:async () => {
    assert.equal(inTransaction,false,'OSS 上传不应在数据库事务中执行')
    return {storageName:'pmis/a.txt',ossResponse:{data:[{id:'x',fileName:'a.txt',filePath:'pmis/a.txt',fileUrl:'http://oss.example.com/pmis/a.txt'}]}}
  }})
  const result=await service.operate(token,'requirement',{operation:'ATTACHMENT_UPLOAD',sourceRecordId:'REQ-1',operatorEmployeeNo:'EMP001',idempotencyKey:'file-1'},{file:{originalname:'a.txt',mimetype:'text/plain',buffer:Buffer.from('a')}})
  assert.equal(result.code,0,JSON.stringify(result))
})

test('运维工单查询的提出时间与页面一致返回日期',async () => {
  const token=`sidm_open_${'b'.repeat(43)}`
  const client={id:1,enabled:1,token_hash:hash(token),expires_at:null}
  const row={id:7,is_deleted:0,product_id:3,problem_type:4,follower_id:2,creator_id:2,updater_id:2,problem_desc:'问题',urgency:1,status:0,is_overdue:0,expected_resolve_date:'2026-09-08T00:00:00+08:00',submitter_name:'张三',submitter_dept:'信息部',submit_time:'2026-09-07T00:00:00+08:00',created_at:'2026-09-07T08:00:00+08:00',updated_at:'2026-09-07T08:00:00+08:00'}
  const connection={
    query:async()=>{},writeLog:async()=>{},
    prepare(sql){return{
      get:async()=>{
        if(sql.includes('token_hash=?'))return client
        if(sql.includes('pms_open_client WHERE id'))return client
        if(sql.includes('pms_user WHERE employee_no'))return{id:2,employee_no:'EMP001',real_name:'张三'}
        if(sql.includes('pms_open_record'))return{target_id:7}
        if(sql.includes('pms_work_order WHERE id'))return row
        if(sql.includes('SELECT name FROM pms_product'))return{name:'产品'}
        if(sql.includes('SELECT code FROM pms_archive'))return{code:'PT001'}
        return undefined
      },
      all:async()=>{
        if(sql.includes('SELECT DISTINCT m.path'))return[{path:'/work-orders'}]
        if(sql.includes('FROM pms_user WHERE id=ANY'))return[{id:2,employee_no:'EMP001',real_name:'张三'}]
        return[]
      },
      run:async()=>({changes:1}),
    }},
  }
  const db={...connection,transaction:async(work)=>work(connection)}
  const result=await createOpenApiService({db}).operate(token,'work_order',{operation:'QUERY',sourceRecordId:'WO-1',operatorEmployeeNo:'EMP001'})
  assert.equal(result.code,0,JSON.stringify(result))
  assert.equal(result.data.submitTime,'2026-09-07')
})
