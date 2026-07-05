import type { ComponentProps, ReactNode } from 'react';
import { App, Popconfirm } from 'antd';
import { PermissionButton } from '../PermissionButton';

type BubbleConfirmActionProps = Omit<ComponentProps<typeof PermissionButton>, 'onClick' | 'variant' | 'title'> & {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  onConfirm: () => Promise<void> | void;
  successMessage?: string | false;
  variant?: 'button' | 'text';
};

export function BubbleConfirmAction({
  title,
  description,
  permission,
  danger,
  disabled,
  children,
  onConfirm,
  successMessage = '操作成功',
  variant = 'button',
  className,
  type,
  size,
  ...buttonProps
}: BubbleConfirmActionProps) {
  const { message } = App.useApp();
  const isTextAction = variant === 'text';
  const actionClassName = isTextAction
    ? ['admin-text-action', danger ? 'is-danger' : '', className].filter(Boolean).join(' ')
    : className;

  const handleConfirm = async () => {
    await onConfirm();
    if (successMessage) {
      message.success(successMessage);
    }
  };

  return (
    <Popconfirm
      title={title}
      description={description}
      okText={danger ? '删除' : '确认'}
      cancelText="取消"
      okButtonProps={{ danger }}
      disabled={disabled}
      onConfirm={handleConfirm}
    >
      <PermissionButton
        permission={permission}
        danger={danger}
        disabled={disabled}
        className={actionClassName}
        size={isTextAction ? 'small' : size}
        type={isTextAction ? 'link' : type}
        {...buttonProps}
      >
        {children}
      </PermissionButton>
    </Popconfirm>
  );
}
