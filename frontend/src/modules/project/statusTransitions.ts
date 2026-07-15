import type { ProjectRecord, ProjectStatus } from './types';

export const statusTransitions: Record<Exclude<ProjectStatus, 3>, ProjectStatus[]> = {
  0: [1, 3],
  1: [2, 3],
  2: [3]
};

export function allowedProjectStatuses(project: Pick<ProjectRecord, 'status'>): ProjectStatus[] {
  if (project.status === 3) return [0, 1, 2];
  return statusTransitions[project.status];
}
