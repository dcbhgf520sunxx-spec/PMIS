import { request, unwrap } from './requestClient';
import { arrayContract, objectContract } from './responseContract';
import type { PageResult } from '../types/api';
import type { ProductFormValues, ProductRecord, ProductStatus } from '../modules/product/types';

type Row = { id:number; name:string; description?:string; owner_id:number; owner_name?:string; status:number; creator_name?:string; updater_name?:string; created_at?:string; updated_at?:string };
const rowContract = objectContract<Row>(['id','name','owner_id','status']);
const pageContract = objectContract<{list:Row[];total:number;page:number;pageSize:number}>(['list','total','page','pageSize'], { list: arrayContract(rowContract) });
const optionContract = objectContract<{id:number;name:string;status:number}>(['id','name','status']);
const optionsContract = arrayContract(optionContract);
const idContract = objectContract<{id:number}>(['id']);
const historyItemContract = objectContract<{id:number;action:string;field_name?:string;old_value?:string;new_value?:string;created_at:string;operator:string}>(['id','action','created_at','operator']);
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
export async function getProductHistory(id:string){return unwrap<Array<{id:number;action:string;field_name?:string;old_value?:string;new_value?:string;created_at:string;operator:string}>>(request.get(`/products/${id}/history`),historyContract)}
