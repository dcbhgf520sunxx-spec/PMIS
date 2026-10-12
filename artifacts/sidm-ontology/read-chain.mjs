// 只读数据采集；本体定义、推理、校验与答案由 standard/ 执行。
import {collectCommerce} from './commerce.mjs';
import {collectOperations} from './operations.mjs';
import {collectDelivery} from './delivery.mjs';
const validId = v => (typeof v === 'string' && /^[1-9]\d*$/.test(v)) || (Number.isSafeInteger(v) && v>0);
function requireId(v) { if(!validId(v)) throw new Error('记录ID无效');return String(v); }
export async function readPages(get,path,query={},pageSize=100) {
 const rows=[],seen=new Set();let total;
 for(let page=1;page<=10000;page++) {
   const data=await get(path,{...query,page,pageSize,sort_field:'createdAt',sort_order:'ascend'});
   if(!Array.isArray(data?.list)||!Number.isSafeInteger(data.total)||data.total<0||data.page!==page||data.pageSize!==pageSize)throw new Error('分页响应结构不符合约定');
   if(total!==undefined&&total!==data.total)throw new Error('读取期间总数变化，请重新读取');
   total=data.total;
   for(const row of data.list){const key=requireId(row.id);if(seen.has(key))throw new Error('分页记录重复，数据可能变化');seen.add(key);rows.push(row);}
   if(total===0||page*pageSize>=total)return rows;
   if(!data.list.length)throw new Error('分页提前为空');
 }
 throw new Error('超出分页读取上限');
}
export async function collect(get,environment,productId,withCommerce=false,withOperations=false,withDelivery=false) {
 productId=requireId(productId);
 const product=await get(`/api/products/${productId}`,{});
 if(String(product?.id)!==productId)throw new Error('产品响应ID不符');
 const requirements=await readPages(get,'/api/requirements',{product_id:productId});
 const projects=await readPages(get,'/api/projects',{product_id:productId});
 const taskMap=new Map();
 for(const [items,key] of [[requirements,'requirement_id'],[projects,'project_id']])for(const row of items) {
   for(const task of await readPages(get,'/api/tasks',{[key]:requireId(row.id)})) {
     const id=requireId(task.id),previous=taskMap.get(id);
     if(previous&&JSON.stringify(previous)!==JSON.stringify(task))throw new Error('跨查询任务内容变化，请重读');
     taskMap.set(id,task);
   }
 }
 const delivery=withDelivery?await collectDelivery(get,projects,requirements,readPages):undefined;
 const operations=withOperations?await collectOperations(get,productId,readPages):undefined;
 const commerce=withCommerce?await collectCommerce(get,projects):undefined;
 return {kind:'api-read',environment,productId,capturedAt:new Date().toISOString(),products:[product],requirements,projects,tasks:[...taskMap.values()],...(commerce===undefined?{}:{commerce}),...(operations===undefined?{}:{operations}),...(delivery===undefined?{}:{delivery})};
}
export function apiReader(base,token,fetchImpl=fetch) {
 const url=new URL(base);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('SIDM_BASE_URL应为不含路径、凭据或参数的根地址');
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('非本机连接必须使用HTTPS');
 if(!token)throw new Error('缺少 SIDM_READ_TOKEN（当前用户登录凭据，请在本机环境配置，不写入文件）');
 return async(path,query={})=>{
   if(!/^\/api\/(products|requirements|projects|tasks)(\/\d+)?$/.test(path)&&!/^\/api\/projects\/\d+\/contract(?:\/stages\/\d+\/payments)?$/.test(path))if(!/^\/api\/products\/\d+\/maintenance-contracts$/.test(path)&&path!=='/api/work-orders'&&path!=='/api/bugs'&&!/^\/api\/projects\/\d+\/stage-plan$/.test(path))throw new Error('不允许的读取路径');
   const target=new URL(path,url);for(const [k,v]of Object.entries(query))target.searchParams.set(k,String(v));
   let res;try {res=await fetchImpl(target,{method:'GET',headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new Error('SIDM查询连接失败、超时或发生重定向');}
   if(!res.ok)throw new Error(`SIDM查询失败 HTTP ${res.status}`);
   let body;try{body=await res.json();}catch{throw new Error('SIDM响应不是JSON');}
   if(body.code!==0||(!body.data&&!(body.data===null&&/^\/api\/projects\/\d+\/contract$/.test(path))))throw new Error('SIDM查询返回失败或无有效数据');
   return body.data;
 };
}
