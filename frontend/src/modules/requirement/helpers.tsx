import { OverdueTag, PriorityTag } from '../../components/admin';
import type { RequirementPriority } from './types';
export function renderRequirementPriority(priority:RequirementPriority){return <PriorityTag level={priority===2?'high':priority===1?'medium':'low'} text={['低','中','高'][priority]}/>}
export function renderRequirementOverdue(isOverdue: boolean, overdueDays?: number) {
  return <OverdueTag overdueDays={isOverdue ? overdueDays : 0} overdue={isOverdue && overdueDays === undefined} />;
}
