import { OverdueTag, PriorityTag } from '../../components/admin';
import type { ProjectPriority } from './types';

export function renderProjectPriority(priority: ProjectPriority) {
  return <PriorityTag level={priority === 2 ? 'high' : priority === 1 ? 'medium' : 'low'} text={['低', '中', '高'][priority]} />;
}

export function renderProjectOverdue(isOverdue: boolean, overdueDays?: number) {
  return <OverdueTag overdueDays={isOverdue ? overdueDays : 0} overdue={isOverdue && overdueDays === undefined} />;
}
