// 仅采集授权接口数据，不计算本体规则。
const id=v=>{if(!/^[1-9]\d*$/.test(String(v))||(typeof v==='number'&&!Number.isSafeInteger(v)))throw Error('记录ID无效');return String(v);};
export async function collectDelivery(get,projects,requirements,readPages){
 const plans=[],bugs=new Map();
 for(const p of projects){const projectId=id(p.id),plan=await get(`/api/projects/${projectId}/stage-plan`);if(!plan||!Array.isArray(plan.stages))throw Error('阶段响应缺失');plans.push({...plan,projectId});}
 for(const [rows,field] of [[projects,'project_id'],[requirements,'requirement_id']])for(const r of rows){
  for(const bug of await readPages(get,'/api/bugs',{[field]:id(r.id)})){const key=id(bug.id),previous=bugs.get(key);if(previous&&JSON.stringify(previous)!==JSON.stringify(bug))throw Error('BUG跨查询内容变化，请重新读取');bugs.set(key,bug);}
 }
 return {plans,bugs:[...bugs.values()]};
}
