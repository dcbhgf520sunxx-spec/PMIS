import { useAuthStore } from '../stores/authStore';

export function usePermission(code?: string) {
  if (!code) return true;
  const permissions = useAuthStore((state) => state.permissions);
  return permissions.includes(code);
}
