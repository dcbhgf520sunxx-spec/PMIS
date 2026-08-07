import type { WorkOrderRecord } from '../types';
import type { WorkOrderListFilters } from './workOrderList.types';
import { problemTypeText } from '../helpers';
import { createListSorters, listSorters } from '../../../components/admin';
export { buildStatusPayload, statusTransitions } from '../workOrderStatusRules';

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
  expectedResolveDateRange: [],
  creatorId: undefined,
  createdAtRange: []
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

export function toDateText(value: unknown) {
  if (!value) return '';
  if (typeof value === 'object' && 'format' in value && typeof value.format === 'function') {
    return value.format('YYYY-MM-DD');
  }
  return String(value).slice(0, 10);
}
