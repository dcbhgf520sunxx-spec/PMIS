import { forwardRef } from 'react';
import type { ComponentRef, ReactNode } from 'react';
import {
  DeleteOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import type { ButtonProps } from 'antd';
import { ConfirmAction, type ConfirmActionProps } from '../ConfirmAction';
import { DeleteConfirmAction, type DeleteConfirmActionProps } from '../DeleteConfirmAction';
import { StatusConfirmAction } from '../StatusConfirmAction';
import './index.css';

type AdminIconActionProps = Omit<ButtonProps, 'children' | 'size' | 'type'> & {
  label: string;
  tooltip?: ReactNode;
};

export const AdminIconAction = forwardRef<ComponentRef<typeof Button>, AdminIconActionProps>(function AdminIconAction({
  label,
  tooltip,
  className,
  ...props
}, ref) {
  const actionClassName = ['admin-icon-action', className].filter(Boolean).join(' ');

  return (
    <Tooltip title={tooltip || label}>
      <Button
        ref={ref}
        {...props}
        aria-label={label}
        className={actionClassName}
        size="small"
        type="text"
      />
    </Tooltip>
  );
});

type AdminConfirmIconActionProps = Omit<ConfirmActionProps, 'children' | 'size' | 'type' | 'tooltip'> & {
  label: string;
  preview?: boolean;
  tooltip?: ReactNode;
};

export function AdminConfirmIconAction({
  label,
  preview,
  tooltip,
  className,
  ...props
}: AdminConfirmIconActionProps) {
  const actionClassName = ['admin-icon-action', className].filter(Boolean).join(' ');

  if (preview) {
    return (
      <AdminIconAction
        danger={props.danger}
        disabled={props.disabled}
        icon={props.icon}
        label={label}
        tooltip={tooltip || label}
      />
    );
  }

  return (
    <ConfirmAction
      {...props}
      aria-label={label}
      className={actionClassName}
      size="small"
      tooltip={tooltip || label}
      type="text"
    >
      {null}
    </ConfirmAction>
  );
}

type AdminEditIconActionProps = Omit<AdminIconActionProps, 'label' | 'icon'>;

export function AdminEditIconAction(props: AdminEditIconActionProps) {
  return (
    <AdminIconAction
      {...props}
      label="编辑"
      icon={<EditOutlined />}
    />
  );
}

type AdminToggleStatusIconActionProps = Omit<
  AdminConfirmIconActionProps,
  'label' | 'title' | 'icon'
> & {
  active: boolean;
  targetName?: ReactNode;
};

export function AdminToggleStatusIconAction({
  active,
  targetName,
  description,
  preview,
  ...props
}: AdminToggleStatusIconActionProps) {
  const label = active ? '停用' : '启用';

  if (preview) {
    return (
      <AdminIconAction
        disabled={props.disabled}
        icon={active ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
        label={label}
        tooltip={label}
      />
    );
  }

  return (
    <StatusConfirmAction
      {...props}
      action={active ? 'disable' : 'enable'}
      aria-label={label}
      className="admin-icon-action"
      description={description}
      icon={active ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
      size="small"
      targetName={targetName}
      tooltip={label}
      type="text"
    >
      {null}
    </StatusConfirmAction>
  );
}

type AdminDeleteIconActionProps = Omit<
  DeleteConfirmActionProps,
  'children' | 'icon' | 'size' | 'type' | 'tooltip'
> & {
  label?: string;
  preview?: boolean;
  tooltip?: ReactNode;
};

export function AdminDeleteIconAction({
  label = '删除',
  preview,
  tooltip,
  className,
  ...props
}: AdminDeleteIconActionProps) {
  const actionClassName = ['admin-icon-action', className].filter(Boolean).join(' ');

  if (preview) {
    return (
      <AdminIconAction
        danger
        disabled={props.disabled}
        icon={<DeleteOutlined />}
        label={label}
        tooltip={tooltip || label}
      />
    );
  }

  return (
    <DeleteConfirmAction
      {...props}
      aria-label={label}
      className={actionClassName}
      icon={<DeleteOutlined />}
      size="small"
      tooltip={tooltip || label}
      type="text"
    >
      {null}
    </DeleteConfirmAction>
  );
}
