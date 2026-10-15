const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs/promises')
const path=require('node:path')
const crypto=require('node:crypto')
test('完成率真实HTTP/PostgreSQL验证v3身份、计算、边界、拒绝、审计与分页',{skip:process.env.MCP_COMPLETION_INTEGRATION!=='1'},async()=>{
 const schema=`completion_test_${crypto.randomBytes(8).toString('hex')}`
 process.env.DB_OPTIONS=`-c search_path=${schema} -c timezone=Asia/Shanghai`
 const pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}})
 process.env.MCP_EMPLOYEE_RSA_PRIVATE_KEY_BASE64=Buffer.from(pair.privateKey).toString('base64')
 process.env.MCP_EMPLOYEE_ASSERTION_SECRET=crypto.randomBytes(32).toString('base64url')
 process.env.MCP_EMPLOYEE_LEGACY_IDENTITY_ENABLED='false'
 const db=require('../src/db'),express=require('express')
 const {Client}=require('@modelcontextprotocol/sdk/client/index.js')
 const {StreamableHTTPClientTransport}=require('@modelcontextprotocol/sdk/client/streamableHttp.js')
 const {createMcpRouter}=require('../src/routes/mcp')
 const {createEmployeeIdentityAssertion}=require('../src/services/mcpEmployeeIdentityCrypto')
 const {hashToken}=require('../src/services/mcpCredentialService')
 const {shanghaiDate}=require('../src/services/mcpPeriodAnalysisService')
 let server
 const clients=[]
 const pendingRequests=new Set()
 try{
  assert.ok(['localhost','127.0.0.1','::1'].includes(db.pool.options.host),'仅允许本地隔离测试')
  await db.exec(`CREATE SCHEMA ${schema}`)
  const init=(await fs.readFile(path.join(__dirname,'../db/init/001_schema.sql'),'utf8')).replace(/^ALTER (DATABASE|ROLE).*$/gm,'')
  await db.exec(init)
  await db.exec('INSERT INTO pms_role_menu(role_id,menu_id) SELECT 1,id FROM pms_menu ON CONFLICT DO NOTHING')
  const today=shanghaiDate()
  const taskType=await db.prepare("SELECT a.id FROM pms_archive a JOIN pms_archive_type t ON t.id=a.archive_type_id WHERE t.code='task_type' ORDER BY a.id LIMIT 1").get()
  for(const [id,status] of [[1,2],[2,1],[3,3],[4,4]]){
   await db.prepare('INSERT INTO pms_task(id,name,source_type,task_type,status,expected_end_date,actual_end_date) VALUES(?,?,3,?,?,?,?)').run(id,`隔离任务${id}`,taskType.id,status,today,status===2?today:null)
   await db.exec('INSERT INTO pms_task_owner(task_id,user_id) VALUES(?,1)',[id])
  }
  const product=await db.prepare('INSERT INTO pms_product(name,owner_id) VALUES(?,1)').run('隔离产品')
  const requirement=await db.prepare("INSERT INTO pms_requirement(title,product_id,owner_id,requirement_type,status,expected_end_date,submitter_name,submit_date) VALUES(?,?,1,4,37,?,'测试提报人',?)").run('取消关闭的需求',product.lastInsertRowid,today,today)
  const project=await db.prepare('INSERT INTO pms_project(name,product_id,owner_id,requirement_id,status,expected_end_date) VALUES(?,?,1,?,2,?)').run('隔离项目',product.lastInsertRowid,requirement.lastInsertRowid,today)
  await db.prepare('INSERT INTO pms_task(id,name,source_type,task_type,project_id,status,expected_end_date) VALUES(5,?,1,?,?,2,?)').run('上级需求关闭的任务',taskType.id,project.lastInsertRowid,today)
  await db.exec('INSERT INTO pms_task_owner(task_id,user_id) VALUES(5,1)')
  const token=`pmis_q_${crypto.randomBytes(32).toString('base64url')}`
  const issued=await db.prepare('INSERT INTO pms_mcp_client(name,token_prefix,token_hash,endpoint_type) VALUES(?,?,?,?)').run('隔离测试客户端',token.slice(0,12),hashToken(token),'query')
  const clientId=Number(issued.lastInsertRowid)
  const router=createMcpRouter('query')
  // Observe asynchronous middleware/route completion, including audit writes after the HTTP response.
  for(const layer of router.stack.flatMap(layer=>layer.route?layer.route.stack:[layer])){
   const original=layer.handle
   layer.handle=function(...args){
    const result=original.apply(this,args)
    if(result?.then){pendingRequests.add(result);result.then(()=>pendingRequests.delete(result),()=>pendingRequests.delete(result))}
    return result
   }
  }
  const app=express();app.use(express.json());app.use('/api/mcp/query',router)
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve))
  const url=new URL(`http://127.0.0.1:${server.address().port}/api/mcp/query`)
  async function connect(employeeNo){
   const client=new Client({name:'completion-http-test',version:'1'})
   const transport=new StreamableHTTPClientTransport(url,{fetch:async(target,init)=>{
    const headers=new Headers(init?.headers);headers.set('Authorization','Bearer '+token)
    headers.set('X-PMIS-Employee-No',createEmployeeIdentityAssertion(employeeNo,{clientId,endpointType:'query',rsaPublicKey:pair.publicKey}))
    return fetch(target,{...init,headers})
   }})
   clients.push(client);await client.connect(transport);return client
  }
  const client=await connect('admin'),tools=(await client.listTools()).tools
  assert.ok(tools.some(t=>t.name==='business_completion_analysis'))
  const args={analysis_period:{preset:'day',anchor_date:today},business_types:['task'],page_size:1}
  const response=await client.callTool({name:'business_completion_analysis',arguments:args})
  assert.equal(response.isError,undefined,JSON.stringify(response.structuredContent))
  const result=response.structuredContent
  assert.equal(result.results[0].statistic_count,3);assert.equal(result.results[0].completed_count,1)
  assert.equal(result.results[0].completion_rate,33.33);assert.equal(result.results[0].excluded_count,2)
  const second=await client.callTool({name:'business_completion_analysis',arguments:{...args,page:2,dataset_token:result.details.datasetToken}})
  assert.equal(second.structuredContent.details.items[0].record_id,2)
  await db.prepare('UPDATE pms_task SET status=2,actual_end_date=? WHERE id=2').run(today)
  const changed=await client.callTool({name:'business_completion_analysis',arguments:{...args,page:2,dataset_token:result.details.datasetToken}})
  assert.equal(changed.structuredContent.error.code,'MCP_DATA_CHANGED')
  const bad=await client.callTool({name:'business_completion_analysis',arguments:{...args,current_user_id:99}})
  assert.equal(bad.structuredContent.error.code,'MCP_ARGUMENT_INVALID')
  await db.prepare("INSERT INTO pms_user(employee_no,real_name,password,phone,status) VALUES(?,?,?,'13900000000',1)").run('NO_COMPLETION_ACCESS','无权限测试人员','unused-fixture-hash')
  const denied=await connect('NO_COMPLETION_ACCESS')
  assert.equal((await denied.listTools()).tools.some(t=>t.name==='business_completion_analysis'),false)
  const rejected=await denied.callTool({name:'business_completion_analysis',arguments:args})
  assert.equal(rejected.structuredContent.error.code,'MCP_PERMISSION_DENIED')
  const audits=await db.prepare("SELECT result_status,error_code,input_summary->>'_identity_version' identity_version FROM pms_mcp_audit_log WHERE tool_name='business_completion_analysis'").all()
  assert.ok(audits.some(a=>a.result_status==='success'&&a.identity_version==='v3'))
  assert.ok(audits.some(a=>a.error_code==='MCP_PERMISSION_DENIED'))
 }finally{
  for(const client of clients)await client.close().catch(()=>{})
  if(server)await new Promise(resolve=>server.close(resolve))
  // Drain protocol audit writes before taking schema-wide exclusive locks.
  while(pendingRequests.size)await Promise.allSettled([...pendingRequests])
  await db.pool.end()
  const {Pool}=require('pg')
  const cleanup=new Pool({...db.pool.options,password:db.pool.options.password,max:1})
  try{await cleanup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)}finally{await cleanup.end()}
 }
})
