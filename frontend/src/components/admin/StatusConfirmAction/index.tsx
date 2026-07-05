import type { ReactNode } from 'react';
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { ConfirmAction, type ConfirmActionProps } from '../ConfirmAction';
import './index.css';

type StatusConfirmActionProps = Omit<ConfirmActionProps, 'title' | 'description' | 'okText'> & {
  action: 'enable' | 'disable';
  entityName?: string;
  targetName?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
};

function getActionText(action: StatusConfirmActionProps['action']) {
  return action === 'enable' ? '启用' : '停用';
}

function renderTitle(action: StatusConfirmActionProps['action'], entityName?: string) {
  const actionText = getActionText(action);
  const Icon = action === 'enable' ? CheckCircleOutlined : ExclamationCircleOutlined;

  return (
    <span className={`admin-status-confirm-action__title is-${action}`}>
      <Icon />
      <span>确认{actionText}{entityName || ''}</span>
    </span>
  );
}

function renderDescription(action: StatusConfirmActionProps['action'], entityName?: string, targetName?: ReactNode) {
  const actionText = getActionText(action);
  const suffix = action === 'enable' ? '将恢复可用。' : '将暂不可用。';

  return (
    <>
      {targetName ? `${actionText}后，${entityName || '记录'} ` : ''}
      {targetName ? <strong>{targetName}</strong> : null}
      {targetName ? ` ${suffix}` : `${actionText}后，该记录${suffix}`}
    </>
  );
}

export function StatusConfirmAction({
  action,
  entityName,
  targetName,
  title,
  description,
  children,
  ...props
}: StatusConfirmActionProps) {
  const actionText = getActionText(action);

  return (
    <ConfirmAction
      {...props}
      okText={actionText}
      title={title || renderTitle(action, entityName)}
      description={description || renderDescription(action, entityName, targetName)}
    >
      {children}
    </ConfirmAction>
  );
}
