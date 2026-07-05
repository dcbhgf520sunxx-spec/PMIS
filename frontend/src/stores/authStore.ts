import { create } from 'zustand';
import type { MenuItem } from '../types/menu';
import type { PermissionCode } from '../types/permission';

export type UserInfo = {
  id: number;
  employee_no: string;
  real_name: string;
  phone?: string;
  avatar_url?: string;
};

export type UserPreference = {
  default_route: string;
  default_page_size: number;
  appearance_mode: 'light';
};

type AuthState = {
  token: string;
  user: UserInfo | null;
  menus: MenuItem[];
  permissions: PermissionCode[];
  accessSessionId: string;
  preference: UserPreference;
  setAuth: (payload: {
    token: string;
    user: UserInfo;
    menus: MenuItem[];
    permissions: PermissionCode[];
    accessSessionId?: string;
  }) => void;
  setUser: (user: UserInfo) => void;
  setPreference: (preference: UserPreference) => void;
  clearAuth: () => void;
};

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('access_token') || '',
  user: readJson<UserInfo | null>('user_info', null),
  menus: readJson<MenuItem[]>('user_menus', []),
  permissions: readJson<PermissionCode[]>('user_permissions', []),
  accessSessionId: localStorage.getItem('access_session_id') || '',
  preference: readJson<UserPreference>('user_preference', {
    default_route: '/home',
    default_page_size: 20,
    appearance_mode: 'light'
  }),
  setAuth: ({ token, user, menus, permissions, accessSessionId }) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user_info', JSON.stringify(user));
    localStorage.setItem('user_menus', JSON.stringify(menus));
    localStorage.setItem('user_permissions', JSON.stringify(permissions));
    localStorage.setItem('access_session_id', accessSessionId || '');
    set({ token, user, menus, permissions, accessSessionId: accessSessionId || '' });
  },
  setUser: (user) => {
    localStorage.setItem('user_info', JSON.stringify(user));
    set({ user });
  },
  setPreference: (preference) => {
    localStorage.setItem('user_preference', JSON.stringify(preference));
    set({ preference });
  },
  clearAuth: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    localStorage.removeItem('user_menus');
    localStorage.removeItem('user_permissions');
    localStorage.removeItem('access_session_id');
    localStorage.removeItem('user_preference');
    set({
      token: '',
      user: null,
      menus: [],
      permissions: [],
      accessSessionId: '',
      preference: {
        default_route: '/home',
        default_page_size: 20,
        appearance_mode: 'light'
      }
    });
  }
}));
