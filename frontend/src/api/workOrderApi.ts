import { request, unwrap } from './requestClient';
import { arrayContract, objectContract } from './responseContract';
import type { PageResult } from '../types/api';
import type { WorkOrderHistoryItem, WorkOrderRecord, WorkOrderStatus } from '../modules/work-order/types';
import { mapPageResult, type PageResponse } from './pageResult';
import { buildWorkOrderQueryParams, type WorkOrderListParams } from './workOrderQueryParams';

type WorkOrderResponse = {
  id: number;
  product_id?: number;
  product_name?: string;
  problem_type: number;
  problem_type_name?: string;
  problem_desc: string;
  result_desc?: string;
  follower_id: number;
  follower_name?: string;
  urgency: number;
  status: number;
  is_overdue: number;
  expected_resolve_date?: string;
  resolve_date?: string;
  close_date?: string;
  suspend_date?: string;
  submitter_name: string;
  submitter_dept: string;
  submit_time: string;
  creator_name?: string;
  updater_name?: string;
  created_at?: string;
  updated_at?: string;
};

const workOrderContract = objectContract<WorkOrderResponse>([
  'id', 'problem_type', 'problem_desc', 'follower_id', 'urgency', 'status',
  'is_overdue', 'submitter_name', 'submitter_dept', 'submit_time'
]);
const workOrderListContract = arrayContract(workOrderContract);
const workOrderIdContract = objectContract<{ id: number }>(['id']);
const overdueRefreshContract = objectContract<{ changed: number; checkedAt: string }>(['changed', 'checkedAt']);
const batchAssignContract = objectContract<{ updated: number; requested: number }>(['updated', 'requested']);
const workOrderHistoryContract = arrayContract(objectContract<{
  time: string;
  user: string;
  title: string;
  details?: Array<{ field: string; oldVal?: string; newVal?: string }>;
}>(['time', 'user', 'title']));

const workOrderPageContract = (value: unknown): value is PageResponse<WorkOrderResponse> => {
  if (!value || typeof value !== 'object') return false;
  const page = value as PageResponse<WorkOrderResponse>;
  return workOrderListContract(page.list)
    && typeof page.total === 'number'
    && typeof page.page === 'number'
    && typeof page.pageSize === 'number';
};

export type { WorkOrderListParams };

export type WorkOrderFormPayload = {
  productId: string;
  problemDesc: string;
  problemType: string;
  urgency: number;
  followerId: string;
  submitterName: string;
  submitterDept: string;
  submitTime: string;
  expectedResolveDate: string;
};

export type WorkOrderStatusPayload = {
  status: WorkOrderStatus;
  resolveDate?: string | null;
  closeDate?: string | null;
  suspendDate?: string | null;
  resultDesc?: string | null;
};

function dateText(value?: string) {
  return value ? String(value).slice(0, 19).replace('T', ' ') : '-';
}

export function toWorkOrderRecord(row: WorkOrderResponse): WorkOrderRecord {
  return {
    id: String(row.id),
    code: `WO-${String(row.id).padStart(5, '0')}`,
    productId: row.product_id ? String(row.product_id) : '',
    productName: row.product_name || '-',
    problemDesc: row.problem_desc,
    problemType: String(row.problem_type),
    problemTypeName: row.problem_type_name || '-',
    followerId: String(row.follower_id),
    followerName: row.follower_name || '-',
    urgency: row.urgency as WorkOrderRecord['urgency'],
    status: row.status as WorkOrderStatus,
    isOverdue: Boolean(Number(row.is_overdue)),
    expectedResolveDate: dateText(row.expected_resolve_date).slice(0, 10),
    submitterName: row.submitter_name,
    submitterDept: row.submitter_dept,
    submitTime: dateText(row.submit_time).slice(0, 10),
    resolveDate: row.resolve_date ? dateText(row.resolve_date).slice(0, 10) : undefined,
    closeDate: row.close_date ? dateText(row.close_date).slice(0, 10) : undefined,
    suspendDate: row.suspend_date ? dateText(row.suspend_date).slice(0, 10) : undefined,
    resultDesc: row.result_desc,
    creatorName: row.creator_name || '-',
    createdAt: dateText(row.created_at),
    updaterName: row.updater_name,
    updatedAt: row.updated_at ? dateText(row.updated_at) : undefined
  };
}

export async function getWorkOrderList(params: WorkOrderListParams = {}): Promise<PageResult<WorkOrderRecord>> {
  const response = await unwrap<PageResponse<WorkOrderResponse>>(request.get('/work-orders', {
    params: buildWorkOrderQueryParams(params)
  }), workOrderPageContract);

  return mapPageResult(response, toWorkOrderRecord);
}

const workOrderNeighborsContract = objectContract<{
  prevId: number | null;
  nextId: number | null;
  ordinal?: number;
  total?: number;
}>(['prevId', 'nextId']);

export async function getWorkOrderNeighbors(id: string, params: Record<string, unknown> = {}) {
  const result = await unwrap<{
    prevId: number | null;
    nextId: number | null;
    ordinal?: number;
    total?: number;
  }>(request.get('/work-orders/neighbors', {
    params: {
      ...params,
      id
    }
  }), workOrderNeighborsContract);

  return {
    prevId: result.prevId === null ? null : String(result.prevId),
    nextId: result.nextId === null ? null : String(result.nextId),
    ordinal: result.ordinal,
    total: result.total
  };
}

export async function getWorkOrder(id: string) {
  const row = await unwrap<WorkOrderResponse>(request.get(`/work-orders/${id}`), workOrderContract);
  return toWorkOrderRecord(row);
}

export async function refreshWorkOrderOverdue() {
  return unwrap<{ changed: number; checkedAt: string }>(request.post('/work-orders/refresh-overdue'), overdueRefreshContract);
}

export async function batchAssignWorkOrders(ids: string[], followerId: string) {
  return unwrap<{ updated: number; requested: number }>(request.put('/work-orders/batch-assign', {
    ids: ids.map((id) => Number(id)),
    follower_id: Number(followerId)
  }), batchAssignContract);
}

function toPayload(values: WorkOrderFormPayload) {
  return {
    problem_type: values.problemType,
    product_id: Number(values.productId),
    problem_desc: values.problemDesc,
    follower_id: Number(values.followerId),
    urgency: values.urgency,
    expected_resolve_date: values.expectedResolveDate,
    submitter_name: values.submitterName,
    submitter_dept: values.submitterDept,
    submit_time: values.submitTime
  };
}

export async function createWorkOrder(values: WorkOrderFormPayload) {
  return unwrap<{ id: number }>(request.post('/work-orders', toPayload(values)), workOrderIdContract);
}

export async function updateWorkOrder(id: string, values: WorkOrderFormPayload) {
  return unwrap<null>(request.put(`/work-orders/${id}`, toPayload(values)));
}

export async function deleteWorkOrder(id: string) {
  return unwrap<null>(request.delete(`/work-orders/${id}`));
}

export async function updateWorkOrderStatus(id: string, payload: WorkOrderStatus | WorkOrderStatusPayload) {
  const data = typeof payload === 'number'
    ? { status: payload }
    : {
      status: payload.status,
      resolve_date: payload.resolveDate,
      close_date: payload.closeDate,
      suspend_date: payload.suspendDate,
      result_desc: payload.resultDesc
    };
  return unwrap<null>(request.put(`/work-orders/${id}/status`, data));
}

export async function getWorkOrderHistory(id: string): Promise<WorkOrderHistoryItem[]> {
  const rows = await unwrap<Array<{ time: string; user: string; title: string; details?: Array<{ field: string; oldVal?: string; newVal?: string }> }>>(
    request.get(`/work-orders/${id}/history`),
    workOrderHistoryContract
  );

  return rows.map((row, index) => ({
    id: String(index + 1),
    operator: row.user || '-',
    action: row.title,
    time: dateText(row.time),
    changes: row.details?.map((item) => ({
      field: item.field,
      before: item.oldVal,
      after: item.newVal
    }))
  }));
}
