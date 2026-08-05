import { AdminDatePicker, AdminFormItem, AdminTextArea, StatusChangeAction, type StatusFlowModalFormValues } from '../../../components/admin';
import type { ProductMaintenanceContract } from '../types';
import { maintenanceContractStatusLabels } from '../maintenanceContractStatus';

type Props = {
  contract: ProductMaintenanceContract;
  block?: boolean;
  variant?: 'button' | 'text';
  onTerminated: (values: { terminationDate: unknown; terminationReason: string }) => Promise<void> | void;
};

export function ProductMaintenanceContractStatusChangeAction({ contract, block, variant, onTerminated }: Props) {
  return <StatusChangeAction
    permission="product"
    block={block}
    variant={variant}
    type="primary"
    title="终止运维合同"
    buttonText="终止合同"
    current={contract.status}
    currentValue={maintenanceContractStatusLabels[contract.status]}
    options={[{ value: 'terminated', label: '已终止', tone: 'danger' }]}
    targetLabel="目标状态"
    renderExtra={(target) => target === 'terminated' ? <>
      <AdminFormItem name="terminationDate" label="终止时间" rules={[{ required: true, message: '请选择终止时间' }]}>
        <AdminDatePicker />
      </AdminFormItem>
      <AdminFormItem name="terminationReason" label="终止原因" rules={[{ required: true, whitespace: true, message: '请填写终止原因' }, { max: 500, message: '终止原因不能超过500字' }]}>
        <AdminTextArea rows={4} maxLength={500} showCount placeholder="请输入终止原因" />
      </AdminFormItem>
    </> : null}
    onConfirm={async (_target, values: StatusFlowModalFormValues) => onTerminated({
      terminationDate: values.terminationDate,
      terminationReason: String(values.terminationReason || ''),
    })}
  />;
}
