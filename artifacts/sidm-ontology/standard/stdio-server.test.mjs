import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../../../backend/package.json',import.meta.url));
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {StdioClientTransport}=require('@modelcontextprotocol/sdk/client/stdio.js');
test('独立进程可发现状态工具，缺凭据拒绝查询且不回退快照',async()=>{
 const client=new Client({name:'stdio-connection-check',version:'1'});
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./stdio-server.mjs',import.meta.url))],env:{PATH:process.env.PATH,SIDM_BASE_URL:'http://127.0.0.1:3103'},stderr:'pipe'});
 try{await client.connect(transport);const tools=(await client.listTools()).tools;assert.deepEqual(tools.map(t=>t.name),['sidm_ontology_connection_status']);const r=await client.callTool({name:'sidm_ontology_connection_status',arguments:{}});assert.equal(r.structuredContent.status,'authorization-required');assert.equal(r.structuredContent.snapshotFallback,false);const denied=await client.callTool({name:'sidm_standard_ontology_query',arguments:{product_id:2,project_id:66}});assert(denied.isError);}finally{await client.close();}
});
