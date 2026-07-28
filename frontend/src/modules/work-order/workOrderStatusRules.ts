import type { WorkOrderStatus } from './types';

export const activeWorkOrderStatuses: WorkOrderStatus[] = [0, 1, 2, 4, 5];

export const statusTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  0: [1, 2, 4],
  1: [2, 4],
  2: [4, 5],
  4: [0, 1, 2],
  5: [2]
};

export function buildStatusPayload(status: WorkOrderStatus, values: Record<string, unknown>) {
  return {
    status,
    resolveDate: values.actualFixedAt && typeof values.actualFixedAt === 'object' && 'format' in values.actualFixedAt
      ? (values.actualFixedAt as { format: (format: string) => string }).format('YYYY-MM-DD')
      : undefined,
    suspendDate: values.suspendedAt && typeof values.suspendedAt === 'object' && 'format' in values.suspendedAt
      ? (values.suspendedAt as { format: (format: string) => string }).format('YYYY-MM-DD')
      : undefined,
    resultDesc: typeof values.result === 'string' ? values.result : undefined,
    activationReason: typeof values.activationReason === 'string' ? values.activationReason : undefined
  };
}
