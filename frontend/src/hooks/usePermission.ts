import { useAuthStore } from '../stores/authStore';

export function usePermission(code?: string) {
  const permissions = useAuthStore((state) => state.permissions);
  return code ? permissions.includes(code) : true;
}
