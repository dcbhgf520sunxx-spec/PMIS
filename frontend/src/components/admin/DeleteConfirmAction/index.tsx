import type { ReactNode } from 'react';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { ConfirmAction, type ConfirmActionProps } from '../ConfirmAction';
import './index.css';

export type DeleteConfirmActionProps = Omit<ConfirmActionProps, 'title' | 'description' | 'danger'> & {
  entityName?: string;
  targetName?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
};

function renderDescription(entityName?: string, targetName?: ReactNode) {
  return (
    <div className="admin-delete-confirm-action__content">
      {targetName ? (
        <div>
          将删除{entityName || '记录'} <strong>{targetName}</strong>。
        </div>
      ) : null}
      <div className="admin-delete-confirm-action__risk">
        删除后无法恢复，请谨慎操作。
      </div>
    </div>
  );
}

function renderTitle(entityName?: string, title?: ReactNode) {
  return (
    <span className="admin-delete-confirm-action__title">
      <ExclamationCircleOutlined />
      <span>{title || `确认删除${entityName || ''}`}</span>
    </span>
  );
}

export function DeleteConfirmAction({
  entityName,
  targetName,
  title,
  description,
  children,
  ...props
}: DeleteConfirmActionProps) {
  return (
    <ConfirmAction
      {...props}
      danger
      title={typeof title === 'string' || !title ? renderTitle(entityName, title) : title}
      description={description || renderDescription(entityName, targetName)}
    >
      {children}
    </ConfirmAction>
  );
}
