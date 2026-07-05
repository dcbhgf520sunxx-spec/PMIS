import { request, unwrap } from './requestClient';
import type { MenuItem } from '../types/menu';
import type { PermissionCode } from '../types/permission';
import type { UserInfo, UserPreference } from '../stores/authStore';

export type LoginParams = {
  account: string;
  password: string;
};

export type LoginResult = {
  token: string;
  first_login: number;
  access_session_id?: string;
  user: UserInfo;
  menus: MenuItem[];
};

export function login(params: LoginParams) {
  return unwrap<LoginResult>(request.post('/auth/login', params));
}

export type CurrentUserResult = {
  id: number;
  employee_no: string;
  real_name: string;
  phone?: string;
  avatar_url?: string;
  status: number;
  roles?: Array<{ id: number; name: string }>;
  last_login_at?: string;
};

export function getCurrentUser() {
  return unwrap<CurrentUserResult>(request.get('/auth/me'));
}

export function updateCurrentProfile(params: { phone?: string }) {
  return unwrap<CurrentUserResult>(request.put('/auth/me/profile', {
    phone: params.phone || null
  }));
}

export function changeCurrentPhone(params: { phone: string; password: string }) {
  return unwrap<CurrentUserResult>(request.put('/auth/me/phone', {
    phone: params.phone,
    password: params.password
  }));
}

export function uploadCurrentAvatar(params: { fileName: string; mimeType: string; contentBase64: string }) {
  return unwrap<{ avatar_url: string }>(request.post('/auth/me/avatar', params));
}

export function resetCurrentAvatar() {
  return unwrap<{ avatar_url: string | null }>(request.delete('/auth/me/avatar'));
}

export function changeCurrentPassword(params: { oldPassword: string; newPassword: string }) {
  return unwrap<null>(request.put('/auth/password', {
    old_password: params.oldPassword,
    new_password: params.newPassword
  }));
}

export function getUserPreference() {
  return unwrap<UserPreference>(request.get('/auth/preferences'));
}

export function updateUserPreference(params: UserPreference) {
  return unwrap<UserPreference>(request.put('/auth/preferences', params));
}

export function derivePermissions(menus: MenuItem[]): PermissionCode[] {
  const values = menus.flatMap((menu) => [menu.code, menu.path].filter(Boolean));
  return Array.from(new Set(values)) as PermissionCode[];
}
