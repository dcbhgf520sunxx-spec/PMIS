import test from 'node:test';
import assert from 'node:assert/strict';
import {readPages,collect} from './read-chain.mjs';
const sample = () => ({kind:'fixture', environment:'fixture:test', productId:'1', capturedAt:'2026-10-08T00:00:00Z', products:[{id:1,name:'虚构产品',owner_id:8,owner_name:'示例人员'}], requirements:[{id:2,title:'虚构需求',product_id:1,status:36,requirement_type:4,owner_id:8}], projects:[{id:3,name:'虚构项目',product_id:1,requirement_id:2,status:1,owner_id:8}], tasks:[{id:4,name:'虚构任务',source_type:1,project_id:3,requirement_id:null,status:1,owners:[{id:8,name:'示例人员'}]}]});
test('分页按组总数读取，不把返回行数当组数',async()=>{
 let calls=0;
 const rows=await readPages(async(_p,q)=>{calls++;return {list: q.page===1?[{id:1},{id:2},{id:3}]:[{id:4}],total:3,page:q.page,pageSize:2};},'/api/tasks',{},2);
 assert.equal(calls,2);assert.equal(rows.length,4);
});
test('分页总数变化拒绝伪完整结果',async()=>{
 await assert.rejects(()=>readPages(async(_p,q)=>({list:[{id:q.page}],total:q.page===1?3:4,page:q.page,pageSize:2}),'/api/projects',{},2),/变化/);
});
test('鉴权失败原样终止采集，不替换为空数据',async()=>{
 await assert.rejects(()=>collect(async()=>{throw new Error('HTTP 403');},'https://example.invalid','1'),/403/);
});
test('采集仅请求选定产品及其需求项目任务，保留分组上下文',async()=>{
 const s=sample();const calls=[];
 const raw=await collect(async(p,q)=>{calls.push([p,q]);if(p==='/api/products/1')return s.products[0];return {list:p==='/api/requirements'?s.requirements:p==='/api/projects'?s.projects:q.project_id?s.tasks:[],total:p==='/api/tasks'&&!q.project_id?0:1,page:1,pageSize:100};},'https://example.invalid','1');
 assert.equal(raw.tasks.length,1);assert.equal(calls.length,5);assert.equal(raw.kind,'api-read');
});
test('HTTP读取只用GET，禁止重定向，401/403不返回空数组',async()=>{
 const {apiReader}=await import('./read-chain.mjs');
 for(const status of [401,403]){
  const get=apiReader('http://localhost:3103','test-only',async(url,options)=>{
   assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(new URL(url).pathname,'/api/products');
   return {ok:false,status};
  });
  await assert.rejects(()=>get('/api/products'),new RegExp(String(status)));
 }
 assert.throws(()=>apiReader('http://external.invalid','test-only'),/HTTPS/);
});
