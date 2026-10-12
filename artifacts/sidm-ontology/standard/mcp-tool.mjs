// Embedded read-only MCP bridge. No listener, credentials or employee identity parameters.
// The host MUST recheck current employee authorization before returning each capture.
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const require=createRequire(new URL('../../../backend/package.json',import.meta.url));
const {Server}=require('@modelcontextprotocol/sdk/server/index.js');
const {ListToolsRequestSchema,CallToolRequestSchema}=require('@modelcontextprotocol/sdk/types.js');
const exec=promisify(execFile),root=fileURLToPath(new URL('.',import.meta.url));
export const definition={name:'sidm_standard_ontology_query',description:'对当前身份授权读取的SIDM数据执行OWL/HermiT、SHACL和SPARQL。仅传产品ID可核对运维合同及工单；另传项目ID可核对项目工作与登记付款。只读，不推断工单所属合同。',inputSchema:{type:'object',properties:{product_id:{type:'integer',minimum:1},project_id:{type:'integer',minimum:1}},required:['product_id'],additionalProperties:false},outputSchema:{type:'object',required:['execution','validation','reasoning','issues','answers','objects','limitations'],properties:{execution:{type:'object'},validation:{type:'object'},reasoning:{type:'object'},issues:{type:'array'},answers:{type:'object'},objects:{type:'object'},limitations:{type:'array',items:{type:'string'}}}},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:true,idempotentHint:true}};
export function createStandardServer({canRead,getAuthorizedCapture,getConnectionStatus}){
 if(typeof canRead!=='function'||typeof getAuthorizedCapture!=='function')throw Error('需要宿主授权检查与读取接口');
 const statusDefinition={name:'sidm_ontology_connection_status',description:'检查本地本体服务连接与授权配置；配置存在不代表身份验证通过。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true}};
 const server=new Server({name:'sidm-standard-ontology',version:'0.1.0'},{capabilities:{tools:{}}});
 server.setRequestHandler(ListToolsRequestSchema,async()=>{try{return{tools:[...(getConnectionStatus?[statusDefinition]:[]),...(await canRead()?[definition]:[])]};}catch{return{tools:getConnectionStatus?[statusDefinition]:[]};}});
 server.setRequestHandler(CallToolRequestSchema,async({params})=>{
  const requestId=randomUUID();let temp,capture;
  const fail=(code,message)=>({isError:true,content:[{type:'text',text:JSON.stringify({error:{code,message,requestId}})}]});
  if(params.name===statusDefinition.name && getConnectionStatus){
   if(Object.keys(params.arguments||{}).length)return fail('MCP_ARGUMENT_INVALID','不接受参数');
   const value=await getConnectionStatus();return{structuredContent:value,content:[{type:'text',text:JSON.stringify(value)}]};
  }
  if(params.name!==definition.name)return fail('MCP_TOOL_NOT_FOUND','工具不存在');
  const a=params.arguments;
  if(!a||Object.keys(a).some(k=>!['product_id','project_id'].includes(k))||!Number.isSafeInteger(a.product_id)||a.product_id<1||(a.project_id!==undefined&&(!Number.isSafeInteger(a.project_id)||a.project_id<1)))return fail('MCP_ARGUMENT_INVALID','仅接受正整数产品ID和可选项目ID');
  try{
   if(!await canRead())return fail('MCP_PERMISSION_DENIED','当前身份无权读取');
   // Host resolves scopes and paths. The model cannot submit a path, graph, identity or proof.
   capture=await getAuthorizedCapture({...a});
   if(!capture)return fail('MCP_PERMISSION_DENIED','当前身份无权读取该范围');
   temp=await mkdtemp(join(tmpdir(),'sidm-standard-'));
   const {stdout}=await exec(join(root,'.venv/bin/python'),[join(root,'answer.py'),typeof capture==='string'?capture:capture.path,a.product_id.toString(),String(a.project_id||0),temp],{timeout:120000,maxBuffer:4*1024*1024});
   const result=JSON.parse(stdout);result.execution.requestId=requestId;
   return{structuredContent:result,content:[{type:'text',text:JSON.stringify(result)}]};
  }catch{return fail('MCP_ONTOLOGY_QUERY_FAILED','标准本体执行失败；请检查授权范围、读取完整性和本体验证日志，未返回部分答案');}
  finally{try{if(temp)await rm(temp,{recursive:true,force:true});}finally{if(capture?.cleanup)await capture.cleanup();}}
 });
 return server;
}
