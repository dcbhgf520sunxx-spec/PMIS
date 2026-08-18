import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { App } from 'antd';
import { PermissionButton } from '../PermissionButton';
import {
  StatusFlowModal,
  type StatusFlowModalFormValues,
  type StatusFlowModalRenderExtra,
  type StatusFlowTone,
  type StatusFlowValue
} from '../StatusFlowModal';

export type StatusChangeOption<T extends StatusFlowValue = StatusFlowValue> = {
  label: string;
  value: T;
  tone: StatusFlowTone;
};

export type StatusChangeActionProps<T extends StatusFlowValue = StatusFlowValue> = Omit<
  ComponentProps<typeof PermissionButton>,
  'children' | 'onClick' | 'title' | 'variant'
> & {
  current?: T;
  currentValue: ReactNode;
  options: ReadonlyArray<StatusChangeOption<T>>;
  children?: ReactNode;
  buttonText?: ReactNode;
  title?: string;
  variant?: 'button' | 'text';
  currentLabel?: string;
  targetLabel?: string;
  formValues?: StatusFlowModalFormValues;
  renderExtra?: StatusFlowModalRenderExtra<T>;
  onConfirm: (target: T, values: StatusFlowModalFormValues) => Promise<void> | void;
};

export function StatusChangeAction<T extends StatusFlowValue = StatusFlowValue>({
  current,
  currentValue,
  options,
  children,
  buttonText = '状态变更',
  title = '状态变更',
  variant = 'button',
  currentLabel,
  targetLabel,
  formValues,
  renderExtra,
  onConfirm,
  className,
  size,
  type,
  ...buttonProps
}: StatusChangeActionProps<T>) {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<T>();
  const [confirming, setConfirming] = useState(false);
  const selectedOption = options.find((item) => item.value === target);
  const isText = variant === 'text';

  const close = () => {
    setOpen(false);
    setTarget(undefined);
  };

  return (
    <>
      <PermissionButton
        {...buttonProps}
        className={[isText ? 'admin-text-action' : '', className].filter(Boolean).join(' ')}
        size={isText ? 'small' : size}
        type={isText ? 'link' : type}
        onClick={() => {
          setTarget(undefined);
          setOpen(true);
        }}
      >
        {children ?? buttonText}
      </PermissionButton>
      <StatusFlowModal<T>
        open={open}
        title={title}
        tone={selectedOption?.tone || 'normal'}
        confirming={confirming}
        currentValue={currentValue}
        targetValue={target}
        formValues={formValues}
        targetOptions={options.filter((item) => current === undefined || item.value !== current)}
        targetText={selectedOption?.label}
        currentLabel={currentLabel}
        targetLabel={targetLabel}
        onTargetChange={setTarget}
        onCancel={close}
        renderExtra={renderExtra}
        onConfirm={async (values) => {
          if (target === undefined) return;
          setConfirming(true);
          try {
            await onConfirm(target, values);
            close();
          } catch (error) {
            message.error(error instanceof Error ? error.message : '操作失败，请稍后重试');
          } finally {
            setConfirming(false);
          }
        }}
      />
    </>
  );
}
