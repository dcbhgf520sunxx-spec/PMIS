import { request, unwrap } from './requestClient';
import { arrayContract, objectContract } from './responseContract';
import type { PageResult } from '../types/api';
import type { ProjectContractAttachment, ProjectContractFormValues, ProjectContractRecord, ProjectFormValues, ProjectPaymentFormValues, ProjectPaymentRecord, ProjectRecord, ProjectStatus } from '../modules/project/types';
import dayjs from 'dayjs';
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
const formatDateInput=(value:unknown)=>{
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  if (typeof (value as { format?: unknown }).format === 'function') {
    return (value as { format: (pattern: string) => string }).format('YYYY-MM-DD');
  }
  const parts = value as { $y?: number; $M?: number; $D?: number };
  if (Number.isInteger(parts.$y) && Number.isInteger(parts.$M) && Number.isInteger(parts.$D)) {
    return `${parts.$y}-${String(Number(parts.$M) + 1).padStart(2, '0')}-${String(parts.$D).padStart(2, '0')}`;
  }
  return dayjs(String(value)).format('YYYY-MM-DD');
};
const formatMonthInput=(value:unknown)=>{
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 7);
  if (typeof (value as { format?: unknown }).format === 'function') {
    return (value as { format: (pattern: string) => string }).format('YYYY-MM');
  }
  const parts = value as { $y?: number; $M?: number };
  if (Number.isInteger(parts.$y) && Number.isInteger(parts.$M)) {
    return `${parts.$y}-${String(Number(parts.$M) + 1).padStart(2, '0')}`;
  }
  return dayjs(String(value)).format('YYYY-MM');
};
const payload=(v:ProjectFormValues)=>({name:v.name,product_id:Number(v.productId),owner_id:Number(v.ownerId),member_ids:(v.memberIds||[]).map(Number),start_date:formatDateInput(v.startDate),expected_end_date:formatDateInput(v.expectedEndDate),description:v.description||null,progress_text:v.progressText||null,risk_text:v.riskText||null});
export async function createProject(v:ProjectFormValues){return unwrap<{id:number}>(request.post('/projects',payload(v)),idContract)}
export async function updateProject(id:string,v:ProjectFormValues){return unwrap<null>(request.put(`/projects/${id}`,payload(v)))}
export async function updateProjectStatus(id:string,status:ProjectStatus,extra:Record<string,unknown>={}){return unwrap<null>(request.put(`/projects/${id}/status`,{status,...extra}))}
export async function deleteProject(id:string){return unwrap<null>(request.delete(`/projects/${id}`))}
export async function getProjectHistory(id:string){return unwrap<ProjectHistoryItem[]>(request.get(`/projects/${id}/history`),historyContract)}

type ContractStageRow = { id: number; contract_id: number; stage_name: string; planned_amount: string | number; paid_amount: string | number; unpaid_amount: string | number; payment_status: number; sort_order: number };
type ContractAttachmentRow = { id: number; contract_id: number; original_name: string; mime_type: string; file_size: number; sort_order: number; creator_name?: string; created_at: string };
type ContractRow = { id: number; project_id: number; project_name: string; contract_code: string; contract_name: string; supplier_id: number; supplier_name: string; signed_date: string; contract_amount: string | number; paid_amount: string | number; unpaid_amount: string | number; stages: ContractStageRow[]; attachments: ContractAttachmentRow[] };
type PaymentRow = { id: number; stage_id: number; payment_amount: string | number; payment_month: string; handler_id: number; handler_name: string; remark?: string; creator_name?: string; created_at: string; updated_at: string };

const contractStageContract = objectContract<ContractStageRow>(['id', 'contract_id', 'stage_name', 'planned_amount', 'paid_amount', 'unpaid_amount', 'payment_status', 'sort_order']);
const contractAttachmentContract = objectContract<ContractAttachmentRow>(['id', 'contract_id', 'original_name', 'mime_type', 'file_size', 'sort_order', 'created_at']);
const contractContract = objectContract<ContractRow>(['id', 'project_id', 'project_name', 'contract_code', 'contract_name', 'supplier_id', 'supplier_name', 'signed_date', 'contract_amount', 'paid_amount', 'unpaid_amount', 'stages', 'attachments'], { stages: arrayContract(contractStageContract), attachments: arrayContract(contractAttachmentContract) });
const nullableContract = (value: unknown): value is ContractRow | null => value === null || contractContract(value);
const paymentContract = objectContract<PaymentRow>(['id', 'stage_id', 'payment_amount', 'payment_month', 'handler_id', 'handler_name', 'created_at', 'updated_at']);

const mapStage = (row: ContractStageRow) => ({
  id: String(row.id), contractId: String(row.contract_id), stageName: row.stage_name,
  plannedAmount: Number(row.planned_amount), paidAmount: Number(row.paid_amount), unpaidAmount: Number(row.unpaid_amount),
  paymentStatus: Number(row.payment_status) as 0 | 1 | 2, sortOrder: Number(row.sort_order),
});
const mapContractAttachment = (row: ContractAttachmentRow): ProjectContractAttachment => ({
  id: String(row.id), contractId: String(row.contract_id), originalName: row.original_name, mimeType: row.mime_type,
  fileSize: Number(row.file_size), sortOrder: Number(row.sort_order), creatorName: row.creator_name || '-', createdAt: dt(row.created_at),
});
const mapContract = (row: ContractRow): ProjectContractRecord => ({
  id: String(row.id), projectId: String(row.project_id), projectName: row.project_name, contractCode: row.contract_code,
  contractName: row.contract_name, supplierId: String(row.supplier_id), supplierName: row.supplier_name, signedDate: date(row.signed_date),
  contractAmount: Number(row.contract_amount), paidAmount: Number(row.paid_amount), unpaidAmount: Number(row.unpaid_amount),
  stages: row.stages.map(mapStage), attachments: row.attachments.map(mapContractAttachment),
});
const contractPayload = (values: ProjectContractFormValues) => ({
  contract_code: values.contractCode,
  contract_name: values.contractName,
  supplier_id: Number(values.supplierId),
  signed_date: formatDateInput(values.signedDate),
  contract_amount: values.contractAmount,
  stages: values.stages.map((stage) => ({ id: stage.id ? Number(stage.id) : undefined, stage_name: stage.stageName, planned_amount: stage.plannedAmount })),
});
const paymentPayload = (values: ProjectPaymentFormValues) => ({
  payment_amount: values.paymentAmount,
  payment_month: formatMonthInput(values.paymentMonth),
  handler_id: Number(values.handlerId),
  remark: values.remark || null,
});

export async function getProjectContract(projectId: string) {
  const row = await unwrap<ContractRow | null>(request.get(`/projects/${projectId}/contract`), nullableContract);
  return row ? mapContract(row) : null;
}
export async function saveProjectContract(projectId: string, values: ProjectContractFormValues, exists: boolean) {
  const promise = exists ? request.put(`/projects/${projectId}/contract`, contractPayload(values)) : request.post(`/projects/${projectId}/contract`, contractPayload(values));
  return exists ? unwrap<null>(promise) : unwrap<{ id: number }>(promise, idContract);
}
export async function uploadProjectContractAttachment(projectId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const row = await unwrap<ContractAttachmentRow>(request.post(`/projects/${projectId}/contract/attachments`, formData), contractAttachmentContract);
  return mapContractAttachment(row);
}
export async function deleteProjectContractAttachment(projectId: string, attachmentId: string) {
  return unwrap<null>(request.delete(`/projects/${projectId}/contract/attachments/${attachmentId}`));
}
export async function loadProjectContractAttachmentPreview(projectId: string, attachmentId: string) {
  const response = await request.get<Blob>(`/projects/${projectId}/contract/attachments/${attachmentId}/download`, { responseType: 'blob' });
  return response.data;
}
export async function downloadProjectContractAttachment(projectId: string, attachmentId: string, fileName: string) {
  const url = URL.createObjectURL(await loadProjectContractAttachmentPreview(projectId, attachmentId));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
export async function getProjectPayments(projectId: string, stageId: string): Promise<ProjectPaymentRecord[]> {
  const rows = await unwrap<PaymentRow[]>(request.get(`/projects/${projectId}/contract/stages/${stageId}/payments`), arrayContract(paymentContract));
  return rows.map((row) => ({ id: String(row.id), stageId: String(row.stage_id), paymentAmount: Number(row.payment_amount), paymentMonth: date(row.payment_month).slice(0, 7), handlerId: String(row.handler_id), handlerName: row.handler_name, remark: row.remark || '', creatorName: row.creator_name || '-', createdAt: dt(row.created_at), updatedAt: dt(row.updated_at) }));
}
export async function createProjectPayment(projectId: string, stageId: string, values: ProjectPaymentFormValues) {
  return unwrap<{ id: number }>(request.post(`/projects/${projectId}/contract/stages/${stageId}/payments`, paymentPayload(values)), idContract);
}
export async function updateProjectPayment(projectId: string, paymentId: string, values: ProjectPaymentFormValues) {
  return unwrap<null>(request.put(`/projects/${projectId}/contract/payments/${paymentId}`, paymentPayload(values)));
}
export async function deleteProjectPayment(projectId: string, paymentId: string) {
  return unwrap<null>(request.delete(`/projects/${projectId}/contract/payments/${paymentId}`));
}
