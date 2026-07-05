import type { UserRecord } from './types';

export const mockUsers: UserRecord[] = Array.from({ length: 32 }, (_, index) => ({
  id: String(index + 1),
  employeeNo: `U${String(index + 1).padStart(4, '0')}`,
  realName: ['管理员', '运维人员', '普通用户', '审核人员'][index % 4],
  roleName: ['系统管理员', '运维角色', '普通角色'][index % 3],
  status: index % 5 === 0 ? 'disabled' : 'enabled',
  createdAt: `2026-06-${String((index % 28) + 1).padStart(2, '0')} 09:30`
}));

export function getMockUser(id?: string) {
  return mockUsers.find((item) => item.id === id) || mockUsers[0];
}
