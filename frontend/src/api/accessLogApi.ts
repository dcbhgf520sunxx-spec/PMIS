import type { PageResult } from '../types/api';
import { request, unwrap } from './requestClient';

type DateLike = {
  format: (template: string) => string;
};

export type AccessLogRecord = {
  id: string;
  userId?: string;
  employeeNo: string;
  account: string;
  realName: string;
  eventType: 'login' | 'login_failed';
  result: 'success' | 'failed' | 'locked';
  failReason: string;
  sessionId: string;
  loginAt: string;
  logoutAt: string;
  lastActiveAt: string;
  durationSeconds: number;
  durationText: string;
  ip: string;
  userAgent: string;
  createdAt: string;
};

export type AccessLogFilters = {
  employeeNo: string;
  account: string;
  realName: string;
  result?: AccessLogRecord['result'];
  failReason?: string;
  ip: string;
  accessTimeRange: DateLike[];
};

type AccessLogResponse = {
  id: number;
  user_id?: number;
  employee_no?: string;
  account?: string;
  real_name?: string;
  event_type: AccessLogRecord['eventType'];
  result: AccessLogRecord['result'];
  fail_reason?: string;
  session_id?: string;
  login_at?: string;
  logout_at?: string;
  last_active_at?: string;
  duration_seconds?: number;
  ip?: string;
  user_agent?: string;
  created_at?: string;
};

function formatDate(value?: string) {
  return String(value || '').slice(0, 19).replace('T', ' ');
}

function formatDuration(seconds?: number) {
  const totalSeconds = Number(seconds || 0);
  if (totalSeconds <= 0) return '-';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const restSeconds = totalSeconds % 60;
  if (hours > 0) return `${hours}小时${minutes}分钟`;
  if (minutes > 0) return `${minutes}分钟${restSeconds}秒`;
  return `${restSeconds}秒`;
}

function toAccessLogRecord(row: AccessLogResponse): AccessLogRecord {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : undefined,
    employeeNo: row.employee_no || '-',
    account: row.account || '-',
    realName: row.real_name || '-',
    eventType: row.event_type,
    result: row.result,
    failReason: row.fail_reason || '-',
    sessionId: row.session_id || '',
    loginAt: formatDate(row.login_at),
    logoutAt: formatDate(row.logout_at),
    lastActiveAt: formatDate(row.last_active_at),
    durationSeconds: Number(row.duration_seconds || 0),
    durationText: formatDuration(row.duration_seconds),
    ip: row.ip || '-',
    userAgent: row.user_agent || '-',
    createdAt: formatDate(row.created_at)
  };
}

function toRangeParams(range: DateLike[]) {
  const [start, end] = range || [];
  return {
    start_time: start ? `${start.format('YYYY-MM-DD')} 00:00:00` : undefined,
    end_time: end ? `${end.format('YYYY-MM-DD')} 23:59:59` : undefined
  };
}

export async function getAccessLogList(params: AccessLogFilters): Promise<PageResult<AccessLogRecord>> {
  const rows = await unwrap<AccessLogResponse[]>(request.get('/access-logs', {
    params: {
      account: params.account || undefined,
      employee_no: params.employeeNo || undefined,
      real_name: params.realName || undefined,
      result: params.result,
      fail_reason: params.failReason,
      ip: params.ip || undefined,
      ...toRangeParams(params.accessTimeRange)
    }
  }));

  return {
    list: rows.map(toAccessLogRecord),
    total: rows.length,
    page: 1,
    pageSize: rows.length
  };
}

export function heartbeatAccessSession(sessionId?: string) {
  if (!sessionId) return Promise.resolve(null);
  return unwrap(request.post('/auth/heartbeat', { session_id: sessionId }));
}

export function logoutAccessSession(sessionId?: string, options?: { preserveLastActive?: boolean }) {
  if (!sessionId) return Promise.resolve(null);
  return unwrap(request.post('/auth/logout', {
    session_id: sessionId,
    preserve_last_active: options?.preserveLastActive ? 1 : 0
  }));
}
