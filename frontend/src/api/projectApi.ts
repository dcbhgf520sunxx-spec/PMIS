import { request, unwrap } from './requestClient';
import { arrayContract, objectContract } from './responseContract';
import type { PageResult } from '../types/api';
import type { ProjectFormValues, ProjectRecord, ProjectStatus } from '../modules/project/types';
type Row={id:number;name:string;description?:string;product_id:number;product_name:string;owner_id:number;owner_name:string;members?:Array<{id:number;name:string}>;status:number;previous_status?:number;is_overdue:number;start_date?:string;expected_end_date:string;actual_end_date?:string;suspend_date?:string;progress_text?:string;risk_text?:string;creator_name?:string;updater_name?:string;created_at?:string;updated_at?:string};
const rowContract=objectContract<Row>(['id','name','product_id','product_name','owner_id','owner_name','status','is_overdue','expected_end_date']);
type ProjectPage={list:Row[];total:number;page:number;pageSize:number;viewCounts:{all:number;mine:number;joined:number}};
const viewCountsContract=objectContract<ProjectPage['viewCounts']>(['all','mine','joined']);
const pageContract=objectContract<ProjectPage>(['list','total','page','pageSize','viewCounts'],{list:arrayContract(rowContract),viewCounts:viewCountsContract});
const idContract=objectContract<{id:number}>(['id']);
export type ProjectHistoryItem={id:number;action:string;created_at:string;operator:string;changes:Array<{field_name?:string;old_value?:string;new_value?:string}>};
const historyItemContract=objectContract<ProjectHistoryItem>(['id','action','created_at','operator','changes']);
const historyContract=arrayContract(historyItemContract);
const date=(v?:string)=>String(v||'').slice(0,10),dt=(v?:string)=>String(v||'').slice(0,19).replace('T',' ');
const map=(r:Row):ProjectRecord=>({id:String(r.id),name:r.name,description:r.description||'',productId:String(r.product_id),productName:r.product_name,ownerId:String(r.owner_id),ownerName:r.owner_name,members:(r.members||[]).map(m=>({id:String(m.id),name:m.name})),memberIds:(r.members||[]).map(m=>String(m.id)),status:Number(r.status) as ProjectStatus,previousStatus:r.previous_status===undefined?undefined:Number(r.previous_status) as ProjectStatus,isOverdue:Boolean(Number(r.is_overdue)),startDate:date(r.start_date),expectedEndDate:date(r.expected_end_date),actualEndDate:date(r.actual_end_date),suspendDate:date(r.suspend_date),progressText:r.progress_text||'',riskText:r.risk_text||'',creatorName:r.creator_name||'-',updaterName:r.updater_name||'-',createdAt:dt(r.created_at),updatedAt:dt(r.updated_at)});
export async function getProjectList(params:Record<string,unknown>={}):Promise<PageResult<ProjectRecord>&{viewCounts:ProjectPage['viewCounts']}>{const r=await unwrap<ProjectPage>(request.get('/projects',{params}),pageContract);return{...r,list:r.list.map(map)}}
export async function getProject(id:string){return map(await unwrap<Row>(request.get(`/projects/${id}`),rowContract))}
const payload=(v:ProjectFormValues)=>({name:v.name,product_id:Number(v.productId),owner_id:Number(v.ownerId),member_ids:(v.memberIds||[]).map(Number),start_date:v.startDate||null,expected_end_date:v.expectedEndDate,description:v.description||null,progress_text:v.progressText||null,risk_text:v.riskText||null});
export async function createProject(v:ProjectFormValues){return unwrap<{id:number}>(request.post('/projects',payload(v)),idContract)}
export async function updateProject(id:string,v:ProjectFormValues){return unwrap<null>(request.put(`/projects/${id}`,payload(v)))}
export async function updateProjectStatus(id:string,status:ProjectStatus,extra:Record<string,unknown>={}){return unwrap<null>(request.put(`/projects/${id}/status`,{status,...extra}))}
export async function deleteProject(id:string){return unwrap<null>(request.delete(`/projects/${id}`))}
export async function getProjectHistory(id:string){return unwrap<ProjectHistoryItem[]>(request.get(`/projects/${id}/history`),historyContract)}
