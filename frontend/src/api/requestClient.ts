import axios from 'axios';
import type { ApiResponse } from '../types/api';
import { useAuthStore } from '../stores/authStore';
import type { ResponseContract } from './responseContract';
import { createApiError } from './apiError';

export const request = axios.create({
  baseURL: '/api',
  timeout: 15000
});

function clearExpiredSession(status?: number) {
  if (status !== 401) return;
  const auth = useAuthStore.getState();
  if (auth.token) auth.clearAuth();
}

request.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (response) => {
    const payload = response.data as ApiResponse<unknown>;
    if (payload && typeof payload.code === 'number' && payload.code !== 0) {
      clearExpiredSession(payload.code);
      return Promise.reject(createApiError(payload));
    }
    return response;
  },
  (error) => {
    const payload = error?.response?.data as ApiResponse<unknown> | undefined;
    clearExpiredSession(Number(payload?.code || error?.response?.status));
    return Promise.reject(createApiError(payload, error?.message || '请求失败'));
  }
);

export async function unwrap<T>(
  promise: Promise<{ data: ApiResponse<T> }>,
  contract?: ResponseContract<T>
): Promise<T> {
  const response = await promise;
  const payload = response.data;
  if (!payload || typeof payload.code !== 'number' || !Object.hasOwn(payload, 'data')) {
    throw new Error('接口返回格式不正确');
  }
  if (contract && !contract(payload.data)) {
    throw new Error('接口数据字段不符合约定');
  }
  return payload.data;
}
