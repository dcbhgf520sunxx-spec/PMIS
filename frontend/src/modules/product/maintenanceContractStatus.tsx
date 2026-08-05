import { StatusTag } from '../../components/admin';
import type { ProductMaintenanceContractStatus } from './types';

export const maintenanceContractStatusLabels: Record<ProductMaintenanceContractStatus, string> = {
  pending: '待生效', active: '生效中', expired: '已到期', renewed: '已续签', terminated: '已终止',
};

export function renderMaintenanceContractStatus(status: ProductMaintenanceContractStatus) {
  const tones = { pending: 'pending', active: 'success', expired: 'error', renewed: 'processing', terminated: 'disabled' } as const;
  return <StatusTag status={tones[status]} text={maintenanceContractStatusLabels[status]} />;
}
