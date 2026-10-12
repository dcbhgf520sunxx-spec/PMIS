// 仅采集授权接口数据，不计算本体规则。
const recordId=v=>{if(!/^[1-9]\d*$/.test(String(v))||(typeof v==='number'&&!Number.isSafeInteger(v)))throw Error('记录ID无效');return String(v);};
export async function collectCommerce(get,projects){
 const entries=[];
 for(const p of projects){
  const projectId=recordId(p.id),contract=await get(`/api/projects/${projectId}/contract`),payments=[];
  if(contract!==null){if(!contract||!Array.isArray(contract.stages))throw Error('合同响应结构异常');
   for(const s of contract.stages){const stageId=recordId(s.id);const records=await get(`/api/projects/${projectId}/contract/stages/${stageId}/payments`);if(!Array.isArray(records))throw Error('付款明细响应结构异常');payments.push({stageId,records});}}
  entries.push({projectId,contract,payments});
 }
 return entries;
}
