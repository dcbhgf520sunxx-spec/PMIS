// Codex local STDIO entry. Credentials come only from the launching environment.
// No snapshot fallback and no persisted login secrets.
import {createRequire} from 'node:module';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {readFileSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandardServer} from './mcp-tool.mjs';
import {collect,apiReader} from '../read-chain.mjs';
const require=createRequire(new URL('../../../backend/package.json',import.meta.url));
const {StdioServerTransport}=require('@modelcontextprotocol/sdk/server/stdio.js');
const base=process.env.SIDM_BASE_URL||'http://127.0.0.1:3103';
const tokenFile=process.env.SIDM_READ_TOKEN_FILE;
let token=process.env.SIDM_READ_TOKEN;
if(!token && tokenFile){
 try {
  const stat=statSync(tokenFile);
  if((stat.mode & 0o077)!==0)throw Error('令牌文件权限不安全');
  token=readFileSync(tokenFile,'utf8').trim();
 } catch {token='';}
}
const pending=new Set();
const server=createStandardServer({getConnectionStatus:async()=>{let network;try{const response=await fetch(new URL('/api/health',base),{signal:AbortSignal.timeout(3000)});network={reachable:true,httpStatus:response.status};}catch(error){network={reachable:false,errorCode:error.cause?.code||error.name};}return{transport:'stdio',engine:'OWL/HermiT + SHACL + SPARQL',dataMode:'live-authorized-rest',credentialConfigured:Boolean(token),authenticationVerified:false,status:token?'configured-query-will-check-auth':'authorization-required',snapshotFallback:false,backendNetwork:network};},canRead:async()=>Boolean(token),getAuthorizedCapture:async({product_id,project_id})=>{
 const reader=apiReader(base,token),calls=[];
 const get=async(path,params={})=>{const data=await reader(path,params);calls.push({path:path.replace(/^\/api/,''),params,at:new Date().toISOString(),...(Array.isArray(data)?{rows:data.length}:Array.isArray(data?.list)?{rows:data.list.length,total:data.total}:{})});return data;};
 // collect only acquires source records; all ontology processing runs in the standard engine.
 const raw=await collect(get,new URL(base).origin,product_id,true,true,true);
 if(project_id!==undefined&&!raw.projects.some(p=>String(p.id)===String(project_id)))throw Error('scope');
 raw.calls=calls;raw.sourceTransport='authorized-rest';raw.consistency='non-transactional-read';
 const dir=await mkdtemp(join(tmpdir(),'sidm-live-read-'));pending.add(dir);
 const path=join(dir,'capture.json');
 await writeFile(path,JSON.stringify(raw,(k,v)=>['description','delivery_requirement'].includes(k)?undefined:v),{mode:0o600});
 return {path,cleanup:async()=>{await rm(dir,{recursive:true,force:true});pending.delete(dir);}};
}});
await server.connect(new StdioServerTransport());
process.stdin.on('end',async()=>{await Promise.all([...pending].map(p=>rm(p,{recursive:true,force:true})));});
