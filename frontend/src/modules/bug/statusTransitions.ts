import type { BugStatus } from './types';

export const bugStatusLabels: Record<BugStatus, string> = { 0: '新建', 1: '已修复', 2: '已关闭', 3: '被激活' };

export function allowedBugStatuses(status: BugStatus): BugStatus[] {
  return ({ 0: [1, 2], 1: [2, 3], 2: [3], 3: [1] } as Record<BugStatus, BugStatus[]>)[status] || [];
}
