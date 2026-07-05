import type { PageResult } from '../types/api';
import type { HrPerson, UserFormValues, UserRecord } from '../modules/user/types';
import { request, unwrap } from './requestClient';

type UserListParams = {
  employeeNo?: string;
  realName?: string;
  phone?: string;
  status?: string;
  roleIds?: string[];
  current?: number;
  pageSize?: number;
};

type UserResponse = {
  id: number;
  employee_no: string;
  real_name: string;
  phone?: string;
  status: number;
  roles?: Array<{ id: number; name: string }>;
  role_ids?: number[];
  creator_name?: string;
  updater_name?: string;
  created_at?: string;
  updated_at?: string;
};

function formatDate(value?: string) {
  return String(value || '').slice(0, 19).replace('T', ' ');
}

function toStatus(status: number): UserRecord['status'] {
  return Number(status) === 1 ? 'enabled' : 'disabled';
}

function toApiStatus(status?: UserRecord['status']) {
  if (!status) return undefined;
  return status === 'enabled' ? 1 : 0;
}

function toUserRecord(row: UserResponse): UserRecord {
  return {
    id: String(row.id),
    employeeNo: row.employee_no,
    realName: row.real_name,
    phone: row.phone || '',
    roleIds: (row.role_ids || row.roles?.map((role) => role.id) || []).map(String),
    roles: row.roles?.map((role) => ({ id: String(role.id), name: role.name })) || [],
    roleName: row.roles?.map((role) => role.name).join('、') || '-',
    status: toStatus(row.status),
    creatorName: row.creator_name || '-',
    updaterName: row.updater_name || '-',
    createdAt: formatDate(row.created_at),
    updatedAt: row.updated_at ? formatDate(row.updated_at) : undefined
  };
}

export async function getUserList(params: UserListParams): Promise<PageResult<UserRecord>> {
  const rows = await unwrap<UserResponse[]>(request.get('/users', {
    params: {
      employee_no: params.employeeNo,
      real_name: params.realName,
      phone: params.phone,
      role_ids: params.roleIds?.length ? params.roleIds.join(',') : undefined,
      status: params.status ? toApiStatus(params.status as UserRecord['status']) : undefined
    }
  }));
  const page = Number(params.current || 1);
  const pageSize = Number(params.pageSize || 20);
  const start = (page - 1) * pageSize;

  return {
    list: rows.map(toUserRecord).slice(start, start + pageSize),
    total: rows.length,
    page,
    pageSize
  };
}

export async function getUser(id: string) {
  const row = await unwrap<UserResponse>(request.get(`/users/${id}`));
  return toUserRecord(row);
}

export async function getUserOptions() {
  const rows = await unwrap<Array<Pick<UserResponse, 'id' | 'employee_no' | 'real_name'>>>(request.get('/user-options'));
  return rows.map((user) => ({ label: `${user.employee_no}·${user.real_name}`, value: String(user.id) }));
}

export async function createUser(values: UserFormValues) {
  return unwrap<{ id: number }>(request.post('/users', {
    employee_no: values.employeeNo,
    real_name: values.realName,
    phone: values.phone || null,
    password: values.password || 'vv123456',
    status: 1,
    role_ids: values.roleIds?.map(Number) || [],
    creator_id: 1
  }));
}

export async function updateUser(id: string, values: UserFormValues) {
  return unwrap<null>(request.put(`/users/${id}`, {
    employee_no: values.employeeNo,
    real_name: values.realName,
    phone: values.phone || null,
    password: values.password || undefined,
    role_ids: values.roleIds?.map(Number) || [],
    updater_id: 1
  }));
}

export async function deleteUser(id: string) {
  return unwrap<null>(request.delete(`/users/${id}`, { data: { updater_id: 1 } }));
}

export async function toggleUserStatus(id: string, status: UserRecord['status']) {
  return unwrap<null>(request.put(`/users/${id}/status`, { status: toApiStatus(status), updater_id: 1 }));
}

export async function resetUserPassword(id: string) {
  return unwrap<null>(request.put(`/users/${id}/reset-password`, { updater_id: 1 }));
}

export async function checkEmployeeNo(employeeNo: string, excludeId?: string) {
  return unwrap<{ available: boolean }>(request.get('/users/check-employee-no', {
    params: { employee_no: employeeNo, excludeId }
  }));
}

export async function checkPhone(phone: string, excludeId?: string) {
  return unwrap<{ available: boolean }>(request.get('/users/check-phone', {
    params: { phone, excludeId }
  }));
}

export async function searchHrPersons(keyword: string): Promise<HrPerson[]> {
  const rows = await unwrap<Array<{ employee_no: string; real_name: string; phone?: string }>>(
    request.get('/users/hr-search', { params: { keyword } })
  );
  return rows.map((row) => ({
    employeeNo: row.employee_no,
    realName: row.real_name,
    phone: row.phone || ''
  }));
}
