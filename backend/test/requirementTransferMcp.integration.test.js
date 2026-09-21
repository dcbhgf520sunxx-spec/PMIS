const root=require('node:path').resolve(__dirname,'..');const db=require(root+'/src/db');const assert=require('node:assert/strict');const crypto=require('crypto');const {dispatchMcpTool:dispatch}=require(root+'/src/mcp/dispatcher');const dispatchMcpTool=(name,args,context)=>dispatch(name,args,{...context,auditRequestId:crypto.randomUUID(),requestId:crypto.randomUUID()});const {filterToolsForContext}=require(root+'/src/mcp/catalog');const {Client}=require(root+'/node_modules/@modelcontextprotocol/sdk/dist/cjs/client/index.js');const {InMemoryTransport}=require(root+'/node_modules/@modelcontextprotocol/sdk/dist/cjs/inMemory.js');const {createMcpServer}=require(root+'/src/mcp/createServer');
require('node:test')('真实 MCP 转项目确认、恢复状态、权限及发现', {skip:process.env.RUN_TRANSFER_MCP_INTEGRATION!=='1'}, async()=>{assert.equal(process.env.INTEGRATION_DB_ISOLATED,'1');const rollback=new Error('rollback MCP fixtures');try{await db.withTransaction(async tx=>{
const product=await tx.prepare("INSERT INTO pms_product(name,owner_id,status,creator_id,updater_id) VALUES(?,1,1,1,1)").run('MCP验收产品'+crypto.randomUUID());
const req=await tx.prepare("INSERT INTO pms_requirement(title,requirement_type,product_id,owner_id,status,submitter_name,submit_date,creator_id,updater_id) VALUES(?,4,?,1,35,'MCP验收',CURRENT_DATE,1,1)").run('MCP验收需求'+crypto.randomUUID(),product.lastInsertRowid);
const rid=Number(req.lastInsertRowid);
const cid=await tx.prepare("INSERT INTO pms_mcp_client(name,token_prefix,token_hash,endpoint_type) VALUES('transfer-test','test',?,'action')").run(crypto.randomBytes(32).toString('hex'));
const ctx={endpointType:'action',allowedMenuPaths:new Set(['/projects','/requirements']),allowedPermissionCodes:new Set(),user:{id:1,employeeNo:'admin',realName:'管理员'},client:{id:Number(cid.lastInsertRowid)},auditRequestId:crypto.randomUUID(),requestId:crypto.randomUUID(),ip:'127.0.0.1'};
const [ct,st]=InMemoryTransport.createLinkedPair();const server=createMcpServer({context:ctx,dispatch:dispatchMcpTool});const client=new Client({name:'transfer-test',version:'1'});await server.connect(st);await client.connect(ct);const listing=await client.listTools();assert.ok(listing.tools.some(t=>t.name==='project_manage'));await client.close();await server.close();
assert.ok(!filterToolsForContext({...ctx,allowedMenuPaths:new Set()}).some(t=>t.name==='project_manage'));
await assert.rejects(()=>dispatchMcpTool('project_manage',{operation:'create',mode:'preview'},ctx));
const args={operation:'create',mode:'preview',name:'MCP转项目验证',requirement_id:rid,product_id:Number(product.lastInsertRowid),owner_id:1,expected_end_date:'2026-12-31',idempotency_key:crypto.randomUUID()};
await assert.rejects(()=>dispatchMcpTool('project_manage',args,{...ctx,allowedMenuPaths:new Set()}));
const preview=await dispatchMcpTool('project_manage',args,ctx);assert.equal(preview.executed,false);assert.notEqual((await tx.prepare('SELECT status FROM pms_requirement WHERE id=?').get(rid)).status,36);
const done=await dispatchMcpTool('project_manage',{...args,mode:'execute',confirmation_id:preview.confirmationId},ctx);assert.equal(done.executed,true);const pid=Number(done.data.id);assert.equal((await tx.prepare('SELECT status FROM pms_requirement WHERE id=?').get(rid)).status,36);
const del={operation:'delete',mode:'preview',id:pid,requirement_release:{status:30}};
await assert.rejects(()=>dispatchMcpTool('project_manage',{operation:'delete',mode:'preview',id:pid},ctx));
const release=await dispatchMcpTool('project_manage',del,ctx);assert.equal(release.preview.displayChanges.requirement_release.status,'需求整理');
await dispatchMcpTool('project_manage',{...del,mode:'execute',confirmation_id:release.confirmationId},ctx);assert.equal((await tx.prepare('SELECT status FROM pms_requirement WHERE id=?').get(rid)).status,30);
console.log('PASS: MCP工具发现、权限拒绝、参数错误、真实preview/execute创建与删除、中文预览、执行后需求回读');throw rollback;
})}catch(e){if(e!==rollback)throw e}finally{await db.pool.end()}})
