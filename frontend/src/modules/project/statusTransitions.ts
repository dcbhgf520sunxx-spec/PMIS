import type { ProjectRecord, ProjectStatus } from './types';

export const statusTransitions: Record<Exclude<ProjectStatus, 3>, ProjectStatus[]> = {
  0: [1, 3],
  1: [2, 3],
  2: [3]
};

export function allowedProjectStatuses(project: Pick<ProjectRecord, 'status' | 'previousStatus'>): ProjectStatus[] {
  if (project.status === 3) return project.previousStatus === undefined ? [0, 1] : [project.previousStatus];
  return statusTransitions[project.status];
}
