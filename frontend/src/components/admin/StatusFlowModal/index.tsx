import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Form } from 'antd';
import type { RefSelectProps } from 'antd/es/select';
import { AdminModal } from '../AdminModal';
import { AdminSelect } from '../AdminSelect';
import { InfoGrid } from '../InfoGrid';
import './index.css';

export type StatusFlowValue = string | number;

export type StatusFlowModalOption<T extends StatusFlowValue = StatusFlowValue> = {
  label: string;
  value: T;
};

export type StatusFlowModalRenderExtra<T extends StatusFlowValue = StatusFlowValue> = (target?: T) => ReactNode;

export type StatusFlowModalFormValues = Record<string, unknown> & {
  targetStatus?: StatusFlowValue;
};

export type StatusFlowModalProps<T extends StatusFlowValue = StatusFlowValue> = {
  open: boolean;
  title?: string;
  currentValue: ReactNode;
  targetValue?: T;
  formValues?: StatusFlowModalFormValues;
  targetOptions: StatusFlowModalOption<T>[];
  targetText?: ReactNode;
  currentLabel?: string;
  targetLabel?: string;
  onTargetChange: (target: T) => void;
  onCancel: () => void;
  onConfirm: (values: StatusFlowModalFormValues) => void;
  renderExtra?: StatusFlowModalRenderExtra<T>;
};

export function StatusFlowModal<T extends StatusFlowValue = StatusFlowValue>({
  open,
  title = '状态变更',
  currentValue,
  targetValue,
  formValues,
  targetOptions,
  targetText,
  currentLabel = '当前状态',
  targetLabel = '目标状态',
  onTargetChange,
  onCancel,
  onConfirm,
  renderExtra
}: StatusFlowModalProps<T>) {
  const [form] = Form.useForm<StatusFlowModalFormValues>();
  const [targetOpen, setTargetOpen] = useState(false);
  const [expandedTarget, setExpandedTarget] = useState<T | undefined>(targetValue);
  const targetSelectRef = useRef<RefSelectProps | null>(null);
  const expandTimerRef = useRef<number | undefined>();

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setTargetOpen(false);
      setExpandedTarget(undefined);
      window.clearTimeout(expandTimerRef.current);
      return;
    }

    form.setFieldsValue({ ...formValues, targetStatus: targetValue });
    setExpandedTarget(targetValue);
  }, [form, formValues, open, targetValue]);

  useEffect(() => () => {
    window.clearTimeout(expandTimerRef.current);
  }, []);

  useEffect(() => {
    if (!open || expandedTarget === undefined) return;
    form.setFieldsValue({ ...formValues, targetStatus: targetValue });
  }, [expandedTarget, form, formValues, open, targetValue]);

  const handleTargetChange = (nextTarget: T) => {
    window.clearTimeout(expandTimerRef.current);
    setTargetOpen(false);
    setExpandedTarget(undefined);
    targetSelectRef.current?.blur?.();
    form.resetFields();
    form.setFieldsValue({ ...formValues, targetStatus: nextTarget });
    onTargetChange(nextTarget);
    expandTimerRef.current = window.setTimeout(() => {
      setExpandedTarget(nextTarget);
    }, 180);
  };

  const handleConfirm = async () => {
    try {
      const values = await form.validateFields();
      onConfirm(values);
    } catch {
      // 具体错误由表单项展示，这里只阻止提交。
    }
  };

  return (
    <AdminModal
      title={title}
      open={open}
      size="small"
      forceRender
      onCancel={onCancel}
      onOk={handleConfirm}
      okButtonProps={{ disabled: targetValue === undefined }}
    >
      <div className="admin-status-flow-modal">
        <InfoGrid
          columns={2}
          items={[
            { label: currentLabel, value: currentValue },
            { label: targetLabel, value: targetValue !== undefined ? (targetText ?? String(targetValue)) : '-' }
          ]}
        />
        <Form form={form} layout="vertical" requiredMark className="admin-status-flow-modal__form">
          <Form.Item
            name="targetStatus"
            label={targetLabel}
            rules={[{ required: true, message: `请选择${targetLabel}` }]}
          >
            <AdminSelect
              ref={targetSelectRef}
              open={targetOpen}
              placeholder={`请选择${targetLabel}`}
              transitionName=""
              options={targetOptions}
              onChange={handleTargetChange}
              onOpenChange={setTargetOpen}
            />
          </Form.Item>
          {renderExtra?.(expandedTarget)}
        </Form>
      </div>
    </AdminModal>
  );
}
