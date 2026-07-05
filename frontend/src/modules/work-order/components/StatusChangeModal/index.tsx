import { Form } from 'antd';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { AdminDatePicker, AdminTextArea, StatusFlowModal } from '../../../../components/admin';
import type { StatusFlowModalFormValues } from '../../../../components/admin';
import type { WorkOrderRecord, WorkOrderStatus } from '../../types';
import { renderWorkOrderStatus } from '../../helpers';

type StatusOption = {
  label: string;
  value: WorkOrderStatus;
};

type StatusChangeModalProps = {
  open: boolean;
  title?: string;
  workOrder?: WorkOrderRecord | null;
  targetStatus?: WorkOrderStatus;
  statusOptions: StatusOption[];
  preserveCompletedValues?: boolean;
  onTargetStatusChange: (status: WorkOrderStatus) => void;
  onCancel: () => void;
  onConfirm: (values: StatusFlowModalFormValues) => void;
};

export function StatusChangeModal({
  open,
  title = '状态变更',
  workOrder,
  targetStatus,
  statusOptions,
  preserveCompletedValues = true,
  onTargetStatusChange,
  onCancel,
  onConfirm
}: StatusChangeModalProps) {
  const formValues = useMemo(() => {
    if (!preserveCompletedValues || !workOrder || workOrder.status !== 3 || targetStatus !== 2) return undefined;
    return {
      actualFixedAt: workOrder.resolveDate ? dayjs(workOrder.resolveDate) : undefined,
      result: workOrder.resultDesc || undefined
    };
  }, [preserveCompletedValues, targetStatus, workOrder]);

  return (
    <StatusFlowModal<WorkOrderStatus>
      title={title}
      open={open}
      currentValue={workOrder ? renderWorkOrderStatus(workOrder.status) : '-'}
      targetValue={targetStatus}
      formValues={formValues}
      targetOptions={statusOptions}
      targetText={targetStatus !== undefined ? renderWorkOrderStatus(targetStatus) : '-'}
      onTargetChange={onTargetStatusChange}
      onCancel={onCancel}
      onConfirm={onConfirm}
      renderExtra={(expandedStatus) => (
        <>
          {expandedStatus === 2 ? (
            <Form.Item
              name="actualFixedAt"
              label="实际修复时间"
              rules={[{ required: true, message: '请选择实际修复时间' }]}
            >
              <AdminDatePicker placeholder="请选择实际修复时间" />
            </Form.Item>
          ) : null}
          {expandedStatus === 3 ? (
            <Form.Item
              name="closedAt"
              label="关闭时间"
              rules={[{ required: true, message: '请选择关闭时间' }]}
            >
              <AdminDatePicker placeholder="请选择关闭时间" />
            </Form.Item>
          ) : null}
          {expandedStatus === 2 ? (
            <Form.Item
              name="result"
              label="处置结果"
              rules={[{ required: true, whitespace: true, message: '请输入处置结果' }]}
            >
              <AdminTextArea rows={3} placeholder="请输入处置结果" />
            </Form.Item>
          ) : null}
        </>
      )}
    />
  );
}
