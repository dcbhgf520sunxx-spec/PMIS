import axios from 'axios';
import type { ApiResponse } from '../types/api';
import { useAuthStore } from '../stores/authStore';

export const request = axios.create({
  baseURL: '/api',
  timeout: 15000
});

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
      return Promise.reject(new Error(payload.message || '请求失败'));
    }
    return response;
  },
  (error) => {
    const message = error?.response?.data?.message || error?.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);

export async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const response = await promise;
  return response.data.data;
}
