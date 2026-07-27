import { request, unwrap } from './requestClient';
import type { MenuItem } from '../types/menu';
import type { PermissionCode } from '../types/permission';
import type { UserInfo, UserPreference } from '../stores/authStore';
import { objectContract } from './responseContract';

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

const loginContract = objectContract<LoginResult>(['token', 'first_login', 'user', 'menus']);

export function login(params: LoginParams) {
  return unwrap<LoginResult>(request.post('/auth/login', params), loginContract);
}

export function exchangeWecomTicket(ticket: string) {
  return unwrap<LoginResult>(
    request.post('/auth/wecom/exchange', { ticket }),
    loginContract
  );
}

export type CurrentUserResult = {
  id: number;
  employee_no: string;
  real_name: string;
  phone?: string;
  avatar_url?: string;
  status: number;
  roles?: string[];
  last_login_at?: string;
};

const currentUserContract = objectContract<CurrentUserResult>(['id', 'employee_no', 'real_name', 'status']);
const avatarUploadContract = objectContract<{ avatar_url: string }>(['avatar_url']);
const avatarResetContract = objectContract<{ avatar_url: string | null }>(['avatar_url']);
const preferenceContract = objectContract<UserPreference>(['default_route', 'default_page_size', 'appearance_mode']);

export function getCurrentUser() {
  return unwrap<CurrentUserResult>(request.get('/auth/me'), currentUserContract);
}

export function updateCurrentProfile(params: { phone?: string }) {
  return unwrap<CurrentUserResult>(request.put('/auth/me/profile', {
    phone: params.phone || null
  }), currentUserContract);
}

export function changeCurrentPhone(params: { phone: string; password: string }) {
  return unwrap<CurrentUserResult>(request.put('/auth/me/phone', {
    phone: params.phone,
    password: params.password
  }), currentUserContract);
}

export function uploadCurrentAvatar(params: { fileName: string; mimeType: string; contentBase64: string }) {
  return unwrap<{ avatar_url: string }>(request.post('/auth/me/avatar', params), avatarUploadContract);
}

export function resetCurrentAvatar() {
  return unwrap<{ avatar_url: string | null }>(request.delete('/auth/me/avatar'), avatarResetContract);
}

export function changeCurrentPassword(params: { oldPassword: string; newPassword: string }) {
  return unwrap<null>(request.put('/auth/password', {
    old_password: params.oldPassword,
    new_password: params.newPassword
  }));
}

export function getUserPreference() {
  return unwrap<UserPreference>(request.get('/auth/preferences'), preferenceContract);
}

export function updateUserPreference(params: UserPreference) {
  return unwrap<UserPreference>(request.put('/auth/preferences', params), preferenceContract);
}

export function derivePermissions(menus: MenuItem[]): PermissionCode[] {
  const values = menus.flatMap((menu) => [menu.code, menu.path].filter(Boolean));
  return Array.from(new Set(values)) as PermissionCode[];
}
