import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { Alert, App, Tooltip } from 'antd';
import { AdminModal } from '../AdminModal';
import { PermissionButton } from '../PermissionButton';
import './index.css';

export type ConfirmActionProps = Omit<ComponentProps<typeof PermissionButton>, 'onClick' | 'variant' | 'title'> & {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  onConfirm: () => Promise<void> | void;
  okText?: string;
  successMessage?: string | false;
  tooltip?: ReactNode;
  variant?: 'button' | 'text';
};

export function ConfirmAction({
  title,
  description,
  permission,
  danger,
  disabled,
  children,
  onConfirm,
  okText,
  successMessage = '操作成功',
  tooltip,
  variant = 'button',
  className,
  type,
  size,
  ...buttonProps
}: ConfirmActionProps) {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleConfirm = async () => {
    setConfirming(true);
    setErrorMessage('');
    try {
      await onConfirm();
      if (successMessage) {
        message.success(successMessage);
      }
      setOpen(false);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '操作失败，请稍后重试';
      setErrorMessage(nextMessage);
      message.error(nextMessage);
    } finally {
      setConfirming(false);
    }
  };

  const isTextAction = variant === 'text';
  const actionClassName = isTextAction
    ? ['admin-text-action', danger ? 'is-danger' : '', className].filter(Boolean).join(' ')
    : className;

  const buttonNode = (
    <PermissionButton
      permission={permission}
      danger={danger}
      disabled={disabled}
      className={actionClassName}
      size={isTextAction ? 'small' : size}
      type={isTextAction ? 'link' : type}
      {...buttonProps}
      onClick={() => {
        setErrorMessage('');
        setOpen(true);
      }}
    >
      {children}
    </PermissionButton>
  );

  return (
    <>
      {tooltip ? <Tooltip title={tooltip}>{buttonNode}</Tooltip> : buttonNode}
      <AdminModal
        title={title}
        open={open}
        size="small"
        okText={okText || (danger ? '删除' : '确认')}
        confirmLoading={confirming}
        okButtonProps={{ danger }}
        onCancel={() => {
          setErrorMessage('');
          setOpen(false);
        }}
        onOk={handleConfirm}
      >
        {description ? (
          <div className="admin-confirm-action__description">
            {description}
          </div>
        ) : null}
        {errorMessage ? (
          <Alert
            className="admin-confirm-action__error"
            type="error"
            showIcon
            message={errorMessage}
          />
        ) : null}
      </AdminModal>
    </>
  );
}
