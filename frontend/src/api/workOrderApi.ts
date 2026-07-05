import { request, unwrap } from './requestClient';
import type { PageResult } from '../types/api';
import type { WorkOrderHistoryItem, WorkOrderRecord, WorkOrderStatus } from '../modules/work-order/types';

type WorkOrderResponse = {
  id: number;
  system_id?: number;
  system_name?: string;
  problem_type: number;
  problem_type_name?: string;
  problem_desc: string;
  result_desc?: string;
  follower_id: number;
  follower_name?: string;
  urgency: number;
  status: number;
  is_overdue: number | boolean;
  expected_resolve_date?: string;
  resolve_date?: string;
  close_date?: string;
  submitter_name: string;
  submitter_dept: string;
  submit_time: string;
  creator_name?: string;
  updater_name?: string;
  created_at?: string;
  updated_at?: string;
};

type WorkOrderListParams = {
  problemDesc?: string;
  systemId?: string;
  problemType?: string;
  urgency?: number;
  status?: number;
  isOverdue?: boolean;
  followerId?: string;
  submitterName?: string;
  submitTimeFrom?: string;
  submitTimeTo?: string;
  expectedResolveDateFrom?: string;
  expectedResolveDateTo?: string;
  current?: number;
  pageSize?: number;
};

export type WorkOrderFormPayload = {
  systemId: string;
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
  resultDesc?: string | null;
};

function dateText(value?: string) {
  return String(value || '').slice(0, 19).replace('T', ' ');
}

export function toWorkOrderRecord(row: WorkOrderResponse): WorkOrderRecord {
  return {
    id: String(row.id),
    code: `WO-${String(row.id).padStart(5, '0')}`,
    systemId: row.system_id ? String(row.system_id) : '',
    systemName: row.system_name || '-',
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
    resultDesc: row.result_desc,
    creatorName: row.creator_name || '-',
    createdAt: dateText(row.created_at),
    updaterName: row.updater_name,
    updatedAt: row.updated_at ? dateText(row.updated_at) : undefined
  };
}

export async function getWorkOrderList(params: WorkOrderListParams = {}): Promise<PageResult<WorkOrderRecord>> {
  const rows = await unwrap<WorkOrderResponse[]>(request.get('/work-orders', {
    params: {
      problem_desc: params.problemDesc,
      system_id: params.systemId,
      problem_type: params.problemType,
      urgency: params.urgency,
      status: params.status,
      is_overdue: params.isOverdue === undefined ? undefined : Number(params.isOverdue),
      follower_id: params.followerId,
      submitter_name: params.submitterName,
      submit_time_from: params.submitTimeFrom,
      submit_time_to: params.submitTimeTo,
      expected_resolve_date_from: params.expectedResolveDateFrom,
      expected_resolve_date_to: params.expectedResolveDateTo
    }
  }));
  const page = Number(params.current || 1);
  const pageSize = Number(params.pageSize || 20);
  const start = (page - 1) * pageSize;

  return {
    list: rows.map(toWorkOrderRecord).slice(start, start + pageSize),
    total: rows.length,
    page,
    pageSize
  };
}

export async function getWorkOrder(id: string) {
  const row = await unwrap<WorkOrderResponse>(request.get(`/work-orders/${id}`));
  return toWorkOrderRecord(row);
}

export async function refreshWorkOrderOverdue() {
  return unwrap<{ changed: number; checkedAt: string }>(request.post('/work-orders/refresh-overdue'));
}

export async function batchAssignWorkOrders(ids: string[], followerId: string) {
  return unwrap<{ updated: number; requested: number }>(request.put('/work-orders/batch-assign', {
    ids: ids.map((id) => Number(id)),
    follower_id: Number(followerId),
    updater_id: 1
  }));
}

function toPayload(values: WorkOrderFormPayload) {
  return {
    problem_type: values.problemType,
    system_id: Number(values.systemId),
    problem_desc: values.problemDesc,
    follower_id: Number(values.followerId),
    urgency: values.urgency,
    expected_resolve_date: values.expectedResolveDate,
    submitter_name: values.submitterName,
    submitter_dept: values.submitterDept,
    submit_time: values.submitTime,
    creator_id: 1,
    updater_id: 1
  };
}

export async function createWorkOrder(values: WorkOrderFormPayload) {
  return unwrap<{ id: number }>(request.post('/work-orders', toPayload(values)));
}

export async function updateWorkOrder(id: string, values: WorkOrderFormPayload) {
  return unwrap<null>(request.put(`/work-orders/${id}`, toPayload(values)));
}

export async function deleteWorkOrder(id: string) {
  return unwrap<null>(request.delete(`/work-orders/${id}`, { data: { updater_id: 1 } }));
}

export async function updateWorkOrderStatus(id: string, payload: WorkOrderStatus | WorkOrderStatusPayload) {
  const data = typeof payload === 'number'
    ? { status: payload, updater_id: 1 }
    : {
      status: payload.status,
      resolve_date: payload.resolveDate,
      close_date: payload.closeDate,
      result_desc: payload.resultDesc,
      updater_id: 1
    };
  return unwrap<null>(request.put(`/work-orders/${id}/status`, data));
}

export async function getWorkOrderHistory(id: string): Promise<WorkOrderHistoryItem[]> {
  const rows = await unwrap<Array<{ time: string; user: string; title: string; details?: Array<{ field: string; oldVal?: string; newVal?: string }> }>>(
    request.get(`/work-orders/${id}/history`)
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
