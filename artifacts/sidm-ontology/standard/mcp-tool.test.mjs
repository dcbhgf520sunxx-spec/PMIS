import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createStandardServer,definition} from './mcp-tool.mjs';
const require=createRequire(new URL('../../../backend/package.json',import.meta.url));
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {InMemoryTransport}=require('@modelcontextprotocol/sdk/inMemory.js');
export async function connected(options){const server=createStandardServer(options),client=new Client({name:'standard-verifier',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();await server.connect(b);await client.connect(a);return{client,close:async()=>{await client.close();await server.close();}};}
test('权限撤销后隐藏工具并拒绝调用',async()=>{let allowed=true;const c=await connected({canRead:async()=>allowed,getAuthorizedCapture:async()=>{throw Error('不得读取');}});try{assert.equal((await c.client.listTools()).tools.length,1);allowed=false;assert.equal((await c.client.listTools()).tools.length,0);assert((await c.client.callTool({name:definition.name,arguments:{product_id:1,project_id:2}})).isError);}finally{await c.close();}});
test('拒绝未知工具、身份与路径参数',async()=>{let reads=0;const c=await connected({canRead:async()=>true,getAuthorizedCapture:async()=>{reads++;}});try{for(const req of [{name:'other',arguments:{}},{name:definition.name,arguments:{product_id:1,project_id:2,path:'/etc/passwd'}},{name:definition.name,arguments:{product_id:1,project_id:2,employee_no:'fake'}},{name:definition.name,arguments:{product_id:-1,project_id:2}}])assert((await c.client.callTool(req)).isError);assert.equal(reads,0);}finally{await c.close();}});
test('宿主检查目标范围并且错误不泄露凭据',async()=>{const c=await connected({canRead:async()=>true,getAuthorizedCapture:async()=>{throw Error('secret-token');}});try{const r=await c.client.callTool({name:definition.name,arguments:{product_id:1,project_id:2}});assert(r.isError);assert(!JSON.stringify(r).includes('secret-token'));}finally{await c.close();}});
test('产品级运维查询不强制填写项目',async()=>{let received;const c=await connected({canRead:async()=>true,getAuthorizedCapture:async args=>{received=args;throw Error('expected-test-stop');}});try{const r=await c.client.callTool({name:definition.name,arguments:{product_id:74}});assert(r.isError);assert.deepEqual(received,{product_id:74});}finally{await c.close();}});
