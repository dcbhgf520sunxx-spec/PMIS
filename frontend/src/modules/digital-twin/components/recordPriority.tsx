import { renderRequirementPriority } from '../../requirement/helpers';
import { renderProjectPriority } from '../../project/helpers';
import { renderTaskPriority } from '../../task/helpers';
import { renderBugSeverity } from '../../bug/helpers';
import { renderUrgency } from '../../work-order/helpers';
import type { RequirementPriority } from '../../requirement/types';
import type { ProjectPriority } from '../../project/types';
import type { TaskPriority } from '../../task/types';
import type { BugSeverity } from '../../bug/types';
import type { WorkOrderUrgency } from '../../work-order/types';
import type { TwinRecord } from '../types';

export const priorityFieldLabel = (kind: string) => kind === 'bugs' ? '严重程度' : kind === 'orders' ? '紧急程度' : '优先级';

export function renderTwinRecordPriority(record: TwinRecord) {
    if (record.priorityCode === null) return null;
    switch (record.kind) {
        case 'requirements': return renderRequirementPriority(record.priorityCode as RequirementPriority);
        case 'projects': return renderProjectPriority(record.priorityCode as ProjectPriority);
        case 'tasks': return renderTaskPriority(record.priorityCode as TaskPriority);
        case 'bugs': return renderBugSeverity(record.priorityCode as BugSeverity);
        case 'orders': return renderUrgency(record.priorityCode as WorkOrderUrgency);
        default: return null;
    }
}
