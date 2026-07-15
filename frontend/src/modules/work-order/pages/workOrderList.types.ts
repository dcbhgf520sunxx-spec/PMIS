import type { WorkOrderRecord } from '../types';

export type WorkOrderViewKey = 'all' | 'mine';

export type WorkOrderListFilters = {
  problemDesc: string;
  productId?: string;
  problemTypes: WorkOrderRecord['problemType'][];
  urgency?: WorkOrderRecord['urgency'];
  status?: WorkOrderRecord['status'];
  isOverdue?: boolean;
  followerId?: string;
  submitterName: string;
  submitTimeRange: unknown[];
  expectedResolveDateRange: unknown[];
};
