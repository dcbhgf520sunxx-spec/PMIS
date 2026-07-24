import type { WorkOrderProblemType, WorkOrderStatus, WorkOrderUrgency } from './types';
import { OverdueTag, PriorityTag, StatusTag } from '../../components/admin';

export const problemTypeOptions: Array<{ label: string; value: WorkOrderProblemType }> = [
  { label: '日常操作', value: '1' },
  { label: '系统优化', value: '2' },
  { label: '故障报障', value: '3' },
  { label: '后台维护', value: '4' },
  { label: '其他', value: '5' }
];

export const statusOptions: Array<{ label: string; value: WorkOrderStatus }> = [
  { label: '待处理', value: 0 },
  { label: '处理中', value: 1 },
  { label: '已解决', value: 2 },
  { label: '已关闭', value: 3 },
  { label: '已暂停', value: 4 },
  { label: '被激活', value: 5 }
];

export const urgencyOptions: Array<{ label: string; value: WorkOrderUrgency }> = [
  { label: '低', value: 0 },
  { label: '中', value: 1 },
  { label: '高', value: 2 }
];

export function problemTypeText(value?: WorkOrderProblemType, fallback?: string) {
  return fallback || problemTypeOptions.find((item) => item.value === value)?.label || '-';
}

export function statusText(value?: WorkOrderStatus) {
  return statusOptions.find((item) => item.value === value)?.label || '-';
}

export function urgencyText(value?: WorkOrderUrgency) {
  return urgencyOptions.find((item) => item.value === value)?.label || '-';
}

export function renderWorkOrderStatus(value: WorkOrderStatus) {
  if (value === 0) return <StatusTag status="pending" text="待处理" />;
  if (value === 1) return <StatusTag status="processing" text="处理中" />;
  if (value === 2) return <StatusTag status="success" text="已解决" />;
  if (value === 3) return <StatusTag status="disabled" text="已关闭" />;
  if (value === 4) return <StatusTag status="disabled" text="已暂停" />;
  return <StatusTag status="error" text="被激活" />;
}

export function renderUrgency(value: WorkOrderUrgency) {
  if (value === 2) return <PriorityTag level="high" text="高" />;
  if (value === 1) return <PriorityTag level="medium" text="中" />;
  return <PriorityTag level="low" text="低" />;
}

export function renderOverdue(isOverdue: boolean, expectedResolveDate?: string) {
  if (!isOverdue) return <OverdueTag overdueDays={0} />;
  if (!expectedResolveDate) return <OverdueTag overdue />;
  const due = new Date(expectedResolveDate);
  if (Number.isNaN(due.getTime())) return <OverdueTag overdue />;
  const overdueDays = Math.max(1, Math.ceil((Date.now() - due.getTime()) / 86_400_000));
  return <OverdueTag overdueDays={overdueDays} />;
}
