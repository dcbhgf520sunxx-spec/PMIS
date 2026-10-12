// 仅采集授权接口数据，不计算本体规则。
const id=v=>{if(!/^[1-9]\d*$/.test(String(v))||(typeof v==='number'&&!Number.isSafeInteger(v)))throw Error('记录ID无效');return String(v);};
export async function collectOperations(get,productId,readPages){
 productId=id(productId);
 const contracts=await get(`/api/products/${productId}/maintenance-contracts`);
 if(!Array.isArray(contracts))throw Error('运维合同响应数组缺失');
 const workOrders=await readPages(get,'/api/work-orders',{product_id:productId});
 return {productId,contracts,workOrders};
}
