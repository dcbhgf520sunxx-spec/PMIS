import {request,unwrap} from './requestClient';
import {arrayContract,objectContract} from './responseContract';

export type OpenClient = {id:string;code:string;name:string;enabled:number;expiresAt:string | null;scopes:string[];operatorIds:string[];creatorName:string;updaterName:string;createdAt:string;updatedAt:string};
export type ClientValues = {name:string;expiresAt?:string | null};
type RawClient = {id:number;code:string;name:string;enabled:number;expires_at:string | null;scopes:string[];operator_ids:number[];creator_name:string | null;updater_name:string | null;created_at:string;updated_at:string};
export type ClientRequest = {id:string;requestId:string;resourceType:string;operation:string;operatorName:string;sourceRecordId:string;outcome:string;httpStatus:number;createdAt:string;message:string;fieldErrors:Record<string,string[]> | null};
type RawRequest = {id:number;request_id:string;resource_type:string;operation:string;operator_name:string;source_record_id:string;outcome:string;http_status:number;created_at:string;message:string | null;result:string | null;field_errors:Record<string,string[]> | null};
const clientContract = objectContract<RawClient>(['id','code','name','enabled','scopes','operator_ids','created_at','updated_at']);
const requestContract = objectContract<RawRequest>(['id','request_id','resource_type','operation','outcome','http_status','created_at']);
const time = (s?:string | null) => s ? s.slice(0,19).replace('T',' ') : '';
const toClient = (r:RawClient):OpenClient => ({id:String(r.id),code:r.code,name:r.name,enabled:Number(r.enabled),expiresAt:r.expires_at,scopes:r.scopes,operatorIds:r.operator_ids.map(String),creatorName:r.creator_name || '',updaterName:r.updater_name || '',createdAt:time(r.created_at),updatedAt:time(r.updated_at)});
const base = '/open-clients';
export const listOpenClients = async () => (await unwrap(request.get(base),arrayContract(clientContract))).map(toClient);
export const getOpenClient = async (id:string) => toClient(await unwrap(request.get(`${base}/${id}`),clientContract));
export const saveOpenClient = async (id:string | undefined,values:ClientValues) => toClient(await unwrap(id ? request.put(`${base}/${id}`,values) : request.post(base,values),clientContract));
export const setOpenClientStatus = (id:string,enabled:number) => unwrap<null>(request.patch(`${base}/${id}/status`,{enabled}),(value):value is null => value === null);
export const resetOpenClientCredential = (id:string) => unwrap(request.post(`${base}/${id}/credential`),objectContract<{credential:string}>(['credential']));
export async function getOpenClientRequests(id:string,params:{page:number;pageSize:number;outcome:string;sourceRecordId:string;sortField?:string;sortOrder?:string}) {
  const data = await unwrap(request.get(`${base}/${id}/requests`,{params}),objectContract<{list:RawRequest[];total:number}>(['list','total'],{list:arrayContract(requestContract)}));
  const results:Record<string,string> = {CREATED:'新增成功',UPDATED:'更新成功',DELETED:'删除成功',FOUND:'查询成功',SKIPPED:'无变化，已跳过',ALREADY_DELETED:'已删除，无需重复处理',STATUS_CHANGED:'状态变更成功',PRIORITY_CHANGED:'优先级调整成功'};
  return {total:data.total,list:data.list.map((r):ClientRequest => ({id:String(r.id),requestId:r.request_id,resourceType:r.resource_type,operation:r.operation,operatorName:r.operator_name,sourceRecordId:r.source_record_id,outcome:r.outcome,httpStatus:r.http_status,createdAt:time(r.created_at),message:r.message || results[r.result || ''] || (r.outcome === 'failed' ? `请求失败（${r.http_status}），历史记录未保存具体原因` : r.outcome === 'replayed' ? '重复请求，返回原回执' : ''),fieldErrors:r.field_errors}))};
}
