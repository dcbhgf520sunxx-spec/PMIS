import type { WorkOrderRecord, WorkOrderStatus } from '../types';
import type { WorkOrderListFilters } from './workOrderList.types';
import { problemTypeText } from '../helpers';
import { createListSorters, listSorters } from '../../../components/admin';

export const defaultWorkOrderListFilters: WorkOrderListFilters = {
  problemDesc: '',
  productId: undefined,
  problemTypes: [],
  urgency: undefined,
  status: undefined,
  isOverdue: undefined,
  followerId: undefined,
  submitterName: '',
  submitTimeRange: [],
  expectedResolveDateRange: []
};

export const workOrderSorters = createListSorters<WorkOrderRecord>({
  problemDesc: listSorters.text((row) => row.problemDesc),
  productName: listSorters.text((row) => row.productName),
  problemType: listSorters.text((row) => problemTypeText(row.problemType, row.problemTypeName)),
  followerId: listSorters.text((row) => row.followerName),
  urgency: listSorters.number((row) => row.urgency),
  status: listSorters.number((row) => row.status),
  submitterName: listSorters.text((row) => row.submitterName),
  submitTime: listSorters.date((row) => row.submitTime),
  expectedResolveDate: listSorters.date((row) => row.expectedResolveDate),
  creatorName: listSorters.text((row) => row.creatorName),
  createdAt: listSorters.date((row) => row.createdAt)
});

export const statusTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  0: [1, 3],
  1: [2, 3],
  2: [3],
  3: [0, 1, 2]
};

export function toDateText(value: unknown) {
  if (!value) return '';
  if (typeof value === 'object' && 'format' in value && typeof value.format === 'function') {
    return value.format('YYYY-MM-DD');
  }
  return String(value).slice(0, 10);
}

export function buildStatusPayload(status: WorkOrderStatus, values: Record<string, unknown>) {
  return {
    status,
    resolveDate: values.actualFixedAt && typeof values.actualFixedAt === 'object' && 'format' in values.actualFixedAt
      ? (values.actualFixedAt as { format: (format: string) => string }).format('YYYY-MM-DD')
      : undefined,
    closeDate: values.closedAt && typeof values.closedAt === 'object' && 'format' in values.closedAt
      ? (values.closedAt as { format: (format: string) => string }).format('YYYY-MM-DD')
      : undefined,
    resultDesc: typeof values.result === 'string' ? values.result : undefined
  };
}
