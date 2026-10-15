const test=require('node:test')
const assert=require('node:assert/strict')
const { Client }=require('@modelcontextprotocol/sdk/client/index.js')
const { InMemoryTransport }=require('@modelcontextprotocol/sdk/inMemory.js')
const { AjvJsonSchemaValidator }=require('@modelcontextprotocol/sdk/validation/ajv')
const {createMcpServer}=require('../src/mcp/createServer')
const {dispatchMcpTool}=require('../src/mcp/dispatcher')
const {filterToolsForContext,getToolDefinition,resolvePublicTool}=require('../src/mcp/catalog')
const {analyzeBusinessCompletion}=require('../src/services/mcpCompletionAnalysisService')
const {shanghaiDate}=require('../src/services/mcpPeriodAnalysisService')
const db=require('../src/db')
const today=shanghaiDate(),args={analysis_period:{preset:'day',anchor_date:today},business_types:['task']}
const ctx={endpointType:'query',user:{id:8,employeeNo:'FIXTURE'},client:{id:1},auditRequestId:'completion-fixture',allowedMenuPaths:new Set(['/tasks']),allowedPermissionCodes:new Set()}
function fixture(){
 const state={audits:0,reads:0,rows:[1,2,3].map(id=>({business_type:'task',id,name:`任务${id}`,status:id===1?2:1,owner_id:8,owner_ids:[8],
   plan_date:today,actual_date:id===1?today:null,created_at:today+'T08:00:00+08:00',project_id:null,requirement_id:null,parent_task_id:null}))}
 state.database={prepare(sql){
  if(sql.includes('completion_analysis:people'))return {all:async ([ids])=>ids.map(id=>({id,name:`人员${id}`}))}
  if(sql.includes('period_analysis:records:task'))return {all:async()=>{state.reads++;return structuredClone(state.rows)}}
  if(sql.includes('period_analysis:logs'))return {all:async()=>[]}
  if(sql.includes('INSERT INTO pms_mcp_audit_log'))return {run:async()=>{state.audits++;return {changes:1}}}
  throw Error('测试遇到未隔离SQL')
 }}
 return state
}
test('真实SDK协议发现完成率Query，执行统计、分页、参数错误、权限拒绝并记录审计',async t=>{
 const state=fixture(),original=db.prepare;db.prepare=state.database.prepare
 t.after(()=>{db.prepare=original})
 const [a,b]=InMemoryTransport.createLinkedPair(),server=createMcpServer({context:ctx,dispatch:dispatchMcpTool}),client=new Client({name:'completion-test',version:'1'})
 t.after(async()=>{await client.close();await server.close()})
 await server.connect(b);await client.connect(a)
 const tools=(await client.listTools()).tools,tool=tools.find(t=>t.name==='business_completion_analysis')
 assert.ok(tool)
 assert.deepEqual(tool.inputSchema.properties.business_types.items.enum,['task'])
 assert.equal(getToolDefinition(tool.name,'action'),undefined)
 assert.deepEqual(resolvePublicTool(tool.name,args,'query'),{name:tool.name,args})
 const validate=new AjvJsonSchemaValidator().getValidator(tool.outputSchema)
 const response=await client.callTool({name:tool.name,arguments:{...args,page_size:1}})
 assert.equal(response.isError,undefined)
 const output=response.structuredContent
 assert.equal(validate(output).valid,true)
 assert.equal(output.results[0].statistic_count,3)
 assert.equal(output.results[0].completion_rate,33.33)
 assert.equal(output.details.items.length,1)
 assert.equal(output.details.total,3)
 const second=await client.callTool({name:tool.name,arguments:{...args,page_size:1,page:2,dataset_token:output.details.datasetToken}})
 assert.equal(second.structuredContent.details.items[0].record_id,2)
 state.rows[2].id=4
 const changed=await client.callTool({name:tool.name,arguments:{...args,page_size:1,page:2,dataset_token:output.details.datasetToken}})
 assert.equal(changed.structuredContent.error.code,'MCP_DATA_CHANGED')
 assert.equal(validate(changed.structuredContent).valid,true)
 for(const bad of [{...args,page:2},{...args,page_size:0},{...args,path:'/tmp/file'},{...args,business_types:['project']},
   {...args,analysis_period:{preset:'custom',start_date:'2026-02-30',end_date:'2026-03-01'}}]){
  const r=await client.callTool({name:tool.name,arguments:bad})
  assert.equal(r.isError,true)
  assert.equal(validate(r.structuredContent).valid,true)
 }
 assert.ok(state.audits>=8)
 assert.equal(filterToolsForContext({...ctx,allowedMenuPaths:new Set(['/products'])}).some(t=>t.name===tool.name),false)
})
test('完成率服务无有效身份或越权类别时拒绝读取；停用人员不作为零统计',async()=>{
 const state=fixture()
 await assert.rejects(analyzeBusinessCompletion(args,{...ctx,user:null},state.database),e=>e.code==='MCP_PERMISSION_DENIED')
 await assert.rejects(analyzeBusinessCompletion({...args,business_types:['project']},ctx,state.database),e=>e.code==='MCP_PERMISSION_DENIED')
 assert.equal(state.reads,0)
 const database={prepare(){return {all:async()=>[]}}}
 await assert.rejects(analyzeBusinessCompletion(args,ctx,database),e=>e.code==='MCP_ARGUMENT_INVALID')
})
