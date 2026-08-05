import { request, unwrap } from './requestClient';
import { arrayContract, objectContract } from './responseContract';
import type { PageResult } from '../types/api';
import type { ProductFormValues, ProductMaintenanceContract, ProductMaintenanceContractAttachment, ProductMaintenanceContractFormValues, ProductMaintenanceContractStatus, ProductRecord, ProductStatus } from '../modules/product/types';

type Row = { id:number; name:string; description?:string; owner_id:number; owner_name?:string; status:number; creator_name?:string; updater_name?:string; created_at?:string; updated_at?:string };
const rowContract = objectContract<Row>(['id','name','owner_id','status']);
const pageContract = objectContract<{list:Row[];total:number;page:number;pageSize:number}>(['list','total','page','pageSize'], { list: arrayContract(rowContract) });
const optionContract = objectContract<{id:number;name:string;status:number}>(['id','name','status']);
const optionsContract = arrayContract(optionContract);
const idContract = objectContract<{id:number}>(['id']);
export type ProductHistoryItem = {id:number;action:string;created_at:string;operator:string;changes:Array<{field_name?:string;old_value?:string;new_value?:string;display_mode?:'diff'|'values'}>};
const historyItemContract = objectContract<ProductHistoryItem>(['id','action','created_at','operator','changes']);
const historyContract = arrayContract(historyItemContract);
const dt=(v?:string)=>String(v||'').slice(0,19).replace('T',' ');
const map=(r:Row):ProductRecord=>({id:String(r.id),name:r.name,description:r.description||'',ownerId:String(r.owner_id),ownerName:r.owner_name||'-',status:Number(r.status) as ProductStatus,creatorName:r.creator_name||'-',updaterName:r.updater_name||'-',createdAt:dt(r.created_at),updatedAt:dt(r.updated_at)});
export async function getProductList(params:Record<string,unknown>={}):Promise<PageResult<ProductRecord>>{const r=await unwrap<{list:Row[];total:number;page:number;pageSize:number}>(request.get('/products',{params}),pageContract);return{...r,list:r.list.map(map)}}
export async function getProduct(id:string){return map(await unwrap<Row>(request.get(`/products/${id}`),rowContract))}
export async function getProductOptions(){const rows=await unwrap<Array<{id:number;name:string;status:number}>>(request.get('/products/options'),optionsContract);return rows.map(r=>({label:r.name,value:String(r.id),status:Number(r.status) as ProductStatus}))}
const payload=(v:ProductFormValues)=>({name:v.name,owner_id:Number(v.ownerId),description:v.description||null,status:v.status});
export async function createProduct(v:ProductFormValues){return unwrap<{id:number}>(request.post('/products',payload(v)),idContract)}
export async function updateProduct(id:string,v:ProductFormValues){return unwrap<null>(request.put(`/products/${id}`,payload(v)))}
export async function updateProductStatus(id:string,status:ProductStatus){return unwrap<null>(request.put(`/products/${id}/status`,{status}))}
export async function deleteProduct(id:string){return unwrap<null>(request.delete(`/products/${id}`))}
export async function getProductHistory(id:string){return unwrap<ProductHistoryItem[]>(request.get(`/products/${id}/history`),historyContract)}

type MaintenanceAttachmentRow = { id:number;contract_id:number;original_name:string;mime_type:string;file_size:number;sort_order:number;creator_name?:string;created_at:string };
type MaintenanceContractRow = { id:number;product_id:number;product_name?:string;previous_contract_id?:number;previous_contract_name?:string;contract_code:string;contract_name:string;supplier_id:number;supplier_name:string;signed_date:string;service_start_date:string;service_end_date:string;contract_amount:string|number;termination_date?:string;termination_reason?:string;remark?:string;status:string;has_successor:boolean;creator_name?:string;updater_name?:string;created_at?:string;updated_at?:string;attachments?:MaintenanceAttachmentRow[] };
const maintenanceAttachmentContract=objectContract<MaintenanceAttachmentRow>(['id','contract_id','original_name','mime_type','file_size','sort_order','created_at']);
const maintenanceContractContract=objectContract<MaintenanceContractRow>(['id','product_id','contract_code','contract_name','supplier_id','supplier_name','signed_date','service_start_date','service_end_date','contract_amount','status','has_successor']);
const maintenanceContractListContract=arrayContract(maintenanceContractContract);
const date=(v?:string)=>String(v||'').slice(0,10);
const formatDateInput=(value:unknown)=>{
  if(!value)return null;
  if(typeof value==='string')return value.slice(0,10);
  if(typeof (value as {format?:unknown}).format==='function')return (value as {format:(pattern:string)=>string}).format('YYYY-MM-DD');
  return String(value).slice(0,10);
};
const mapMaintenanceAttachment=(row:MaintenanceAttachmentRow):ProductMaintenanceContractAttachment=>({id:String(row.id),contractId:String(row.contract_id),originalName:row.original_name,mimeType:row.mime_type,fileSize:Number(row.file_size),sortOrder:Number(row.sort_order),creatorName:row.creator_name||'-',createdAt:dt(row.created_at)});
const mapMaintenanceContract=(row:MaintenanceContractRow):ProductMaintenanceContract=>({id:String(row.id),productId:String(row.product_id),productName:row.product_name||'',previousContractId:row.previous_contract_id?String(row.previous_contract_id):'',previousContractName:row.previous_contract_name||'',contractCode:row.contract_code,contractName:row.contract_name,supplierId:String(row.supplier_id),supplierName:row.supplier_name,signedDate:date(row.signed_date),serviceStartDate:date(row.service_start_date),serviceEndDate:date(row.service_end_date),contractAmount:Number(row.contract_amount),terminationDate:date(row.termination_date),terminationReason:row.termination_reason||'',remark:row.remark||'',status:row.status as ProductMaintenanceContractStatus,hasSuccessor:Boolean(row.has_successor),creatorName:row.creator_name||'-',updaterName:row.updater_name||'-',createdAt:dt(row.created_at),updatedAt:dt(row.updated_at),attachments:(row.attachments||[]).map(mapMaintenanceAttachment)});
const maintenancePayload=(values:ProductMaintenanceContractFormValues)=>({contract_code:values.contractCode,contract_name:values.contractName,supplier_id:Number(values.supplierId),signed_date:formatDateInput(values.signedDate),service_start_date:formatDateInput(values.serviceStartDate),service_end_date:formatDateInput(values.serviceEndDate),contract_amount:values.contractAmount,remark:values.remark||null});
const maintenanceFormData=(values:ProductMaintenanceContractFormValues,files:File[])=>{const formData=new FormData();const payload=maintenancePayload(values);for(const [key,value] of Object.entries(payload)){if(value!==null&&value!==undefined)formData.append(key,String(value))}for(const file of files)formData.append('files',file);return formData};
export async function getProductMaintenanceContracts(productId:string){return (await unwrap<MaintenanceContractRow[]>(request.get(`/products/${productId}/maintenance-contracts`),maintenanceContractListContract)).map(mapMaintenanceContract)}
export async function getProductMaintenanceContract(productId:string,contractId:string){const row=await unwrap<MaintenanceContractRow>(request.get(`/products/${productId}/maintenance-contracts/${contractId}`),maintenanceContractContract);return mapMaintenanceContract(row)}
export async function createProductMaintenanceContract(productId:string,values:ProductMaintenanceContractFormValues,files:File[]){return unwrap<{id:number}>(request.post(`/products/${productId}/maintenance-contracts`,maintenanceFormData(values,files)),idContract)}
export async function updateProductMaintenanceContract(productId:string,contractId:string,values:ProductMaintenanceContractFormValues){return unwrap<null>(request.put(`/products/${productId}/maintenance-contracts/${contractId}`,maintenancePayload(values)))}
export async function terminateProductMaintenanceContract(productId:string,contractId:string,values:{terminationDate:unknown;terminationReason:string}){return unwrap<null>(request.put(`/products/${productId}/maintenance-contracts/${contractId}/terminate`,{termination_date:formatDateInput(values.terminationDate),termination_reason:values.terminationReason}))}
export async function deleteProductMaintenanceContract(productId:string,contractId:string){return unwrap<null>(request.delete(`/products/${productId}/maintenance-contracts/${contractId}`))}
export async function uploadProductMaintenanceContractAttachment(productId:string,contractId:string,file:File){const formData=new FormData();formData.append('file',file);const row=await unwrap<MaintenanceAttachmentRow>(request.post(`/products/${productId}/maintenance-contracts/${contractId}/attachments`,formData),maintenanceAttachmentContract);return mapMaintenanceAttachment(row)}
export async function deleteProductMaintenanceContractAttachment(productId:string,contractId:string,attachmentId:string){return unwrap<null>(request.delete(`/products/${productId}/maintenance-contracts/${contractId}/attachments/${attachmentId}`))}
export async function loadProductMaintenanceContractAttachmentPreview(productId:string,contractId:string,attachmentId:string){const response=await request.get<Blob>(`/products/${productId}/maintenance-contracts/${contractId}/attachments/${attachmentId}/download`,{responseType:'blob'});return response.data}
export async function downloadProductMaintenanceContractAttachment(productId:string,contractId:string,attachmentId:string,fileName:string){const url=URL.createObjectURL(await loadProductMaintenanceContractAttachmentPreview(productId,contractId,attachmentId));const anchor=document.createElement('a');anchor.href=url;anchor.download=fileName;anchor.click();URL.revokeObjectURL(url)}
