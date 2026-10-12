import { StatusTag } from '../../../components/admin';
import { renderBugStatus } from '../../bug/helpers';
import type { BugStatus } from '../../bug/types';
import { renderTaskStatus } from '../../task/helpers';
import type { TaskStatus } from '../../task/types';
import { renderProjectStatus } from '../../project/components/ProjectStatusChangeAction';
import { renderProjectPlanItemStatus } from '../../project/components/ProjectPlanStatusChangeAction';
import type { ProjectStatus, ProjectPlanItemStatus } from '../../project/types';
import { renderRequirementStatus } from '../../requirement/components/RequirementStatusChangeAction';
import type { RequirementStatus } from '../../requirement/types';
import { renderWorkOrderStatus } from '../../work-order/helpers';
import type { WorkOrderStatus } from '../../work-order/types';
import { renderMaintenanceContractStatus } from '../../product/maintenanceContractStatus';
import type { ProductMaintenanceContractStatus } from '../../product/types';
import type { TwinRecord } from '../types';

export function renderTwinRecordStatus(record: TwinRecord) {
    if (record.statusCode !== null) {
        switch (record.kind) {
            case 'bugs': return renderBugStatus(record.statusCode as BugStatus);
            case 'tasks': return renderTaskStatus(record.statusCode as TaskStatus);
            case 'projects': return renderProjectStatus(record.statusCode as ProjectStatus);
            case 'requirements': return renderRequirementStatus(record.statusCode as RequirementStatus);
            case 'orders': return renderWorkOrderStatus(record.statusCode as WorkOrderStatus);
            case 'planItems': return renderProjectPlanItemStatus(record.statusCode as ProjectPlanItemStatus);
            case 'maintenance':
                if (record.statusCode !== 'unknown') return renderMaintenanceContractStatus(record.statusCode as ProductMaintenanceContractStatus);
        }
    }
    if (record.kind === 'contracts' || record.kind === 'paymentStages')
        return <StatusTag status={record.status === '已付清' ? 'success' : record.status === '部分付款' ? 'processing' : 'pending'} text={record.status} />;
    if (record.kind === 'payments') return <StatusTag status="success" text={record.status} />;
    return record.kind === 'planStages' ? '—' : record.status;
}
