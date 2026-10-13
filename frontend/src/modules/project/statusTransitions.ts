import type { ProjectRecord, ProjectStatus } from './types';

export const projectStatusLabels: Record<ProjectStatus, string> = {
  0: '未开始',
  1: '进行中',
  2: '已完成',
  3: '已暂停',
  4: '已关闭'
};

export const statusTransitions: Record<Exclude<ProjectStatus, 3>, ProjectStatus[]> = {
  0: [1, 3, 4],
  1: [2, 3, 4],
  2: [3, 4],
  4: [0, 1, 2, 3]
};

export function allowedProjectStatuses(project: Pick<ProjectRecord, 'status'>): ProjectStatus[] {
  if (project.status === 3) return [0, 1, 2, 4];
  return statusTransitions[project.status];
}
