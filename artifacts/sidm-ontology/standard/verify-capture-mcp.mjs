// Local SDK protocol verification using an explicitly supplied, previously authorized capture.
// It is intentionally NOT a production host or a live upstream SIDM MCP integration.
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createStandardServer,definition} from './mcp-tool.mjs';
const require=createRequire(new URL('../../../backend/package.json',import.meta.url));
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {InMemoryTransport}=require('@modelcontextprotocol/sdk/inMemory.js');
const [source,product,project,destination]=process.argv.slice(2);
if(!source||!destination)throw Error('usage: source product_id project_id output.json');
const raw=JSON.parse(await readFile(source,'utf8'));
const server=createStandardServer({canRead:async()=>true,getAuthorizedCapture:async a=>String(a.product_id)===String(raw.productId)&&raw.projects.some(p=>String(p.id)===String(a.project_id))?resolve(source):null});
const client=new Client({name:'local-standard-capture-verifier',version:'0.1'}),[a,b]=InMemoryTransport.createLinkedPair();
try{await server.connect(b);await client.connect(a);const catalog=await client.listTools();if(catalog.tools[0]?.name!==definition.name)throw Error('工具发现失败');const result=await client.callTool({name:definition.name,arguments:{product_id:Number(product),project_id:Number(project)}},undefined,{timeout:150000});if(result.isError)throw Error(result.content[0].text);await writeFile(destination,JSON.stringify({mode:'local-sdk-captured-data-not-online-platform',catalog,result},null,2),{mode:0o600});console.log(JSON.stringify({mode:'local-sdk-captured-data-not-online-platform',tool:definition.name,engine:result.structuredContent.execution.engine,validation:result.structuredContent.validation,answers:result.structuredContent.answers}));}finally{await client.close();await server.close();}
