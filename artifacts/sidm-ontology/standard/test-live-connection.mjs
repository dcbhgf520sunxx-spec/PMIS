// End-to-end local STDIO check. Never print or store the credential.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
const require=createRequire(new URL('../../../backend/package.json',import.meta.url));
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {StdioClientTransport}=require('@modelcontextprotocol/sdk/client/stdio.js');
const [credentialPath,productId,projectId,outputPath]=process.argv.slice(2);
if(!credentialPath||!productId||!projectId||!outputPath)throw Error('usage: credential-file product-id project-id output-json');
const client=new Client({name:'sidm-live-ontology-verifier',version:'1'});
const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./stdio-server.mjs',import.meta.url))],env:{PATH:process.env.PATH,SIDM_BASE_URL:'http://127.0.0.1:3103',SIDM_READ_TOKEN_FILE:credentialPath},stderr:'pipe'});
try{
 await client.connect(transport);
 const catalog=await client.listTools();
 const status=await client.callTool({name:'sidm_ontology_connection_status',arguments:{}});
 if(status.isError||!status.structuredContent.credentialConfigured)throw Error('服务未读取登录授权');
 if(!catalog.tools.some(t=>t.name==='sidm_standard_ontology_query'))throw Error('业务工具未发现');
 const result=await client.callTool({name:'sidm_standard_ontology_query',arguments:{product_id:Number(productId),project_id:Number(projectId)}},undefined,{timeout:150000});
 if(result.isError)throw Error(result.content?.find(c=>c.type==='text')?.text||'查询失败');
 const answer=result.structuredContent;
 if(answer.execution.sourceTransport!=='authorized-rest'||!answer.execution.readCount)throw Error('未从实时授权接口读取');
 await mkdir(dirname(outputPath),{recursive:true,mode:0o700});
 await writeFile(outputPath,JSON.stringify({tools:catalog.tools.map(t=>t.name),status:status.structuredContent,result:answer},null,2),{mode:0o600});
 console.log(JSON.stringify({tools:catalog.tools.map(t=>t.name),status:status.structuredContent.status,transport:answer.execution.sourceTransport,capturedAt:answer.execution.capturedAt,readCount:answer.execution.readCount,validation:answer.validation,requirements:answer.answers.requirements.length,openWork:answer.answers.projectOpenWork.length,payments:answer.answers.projectPayments},null,2));
}finally{await client.close();}
