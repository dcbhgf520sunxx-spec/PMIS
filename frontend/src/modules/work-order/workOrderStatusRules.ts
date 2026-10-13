import type { WorkOrderStatus } from './types';

export const activeWorkOrderStatuses: WorkOrderStatus[] = [0, 1, 2, 3, 4, 5];

export const statusTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  0: [1, 2, 4, 3],
  1: [2, 4, 3],
  2: [4, 5, 3],
  3: [0, 1, 2, 4],
  4: [0, 1, 2, 3],
  5: [2]
};

export function buildStatusPayload(status: WorkOrderStatus, values: Record<string, unknown>) {
  return {
    status,
    closeDate: values.closedAt && typeof values.closedAt === 'object' && 'format' in values.closedAt
      ? (values.closedAt as { format: (format: string) => string }).format('YYYY-MM-DD')
      : undefined,
    closeReason: typeof values.closeReason === 'string' ? values.closeReason : undefined,
    resolveDate: values.actualFixedAt && typeof values.actualFixedAt === 'object' && 'format' in values.actualFixedAt
      ? (values.actualFixedAt as { format: (format: string) => string }).format('YYYY-MM-DD')
      : undefined,
    suspendDate: values.suspendedAt && typeof values.suspendedAt === 'object' && 'format' in values.suspendedAt
      ? (values.suspendedAt as { format: (format: string) => string }).format('YYYY-MM-DD')
      : undefined,
    suspendReason: typeof values.suspendReason === 'string' ? values.suspendReason : undefined,
    resultDesc: typeof values.result === 'string' ? values.result : undefined,
    activationReason: typeof values.activationReason === 'string' ? values.activationReason : undefined
  };
}
