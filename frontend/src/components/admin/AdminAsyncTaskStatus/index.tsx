import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  LoadingOutlined
} from '@ant-design/icons';
import { AdminProgress } from '../AdminPrimitives';
import { AdminTextAction } from '../AdminTextAction';
import './index.css';

export type AdminAsyncTaskState = 'waiting' | 'running' | 'success' | 'error';

export type AdminAsyncTaskStatusProps = {
  state: AdminAsyncTaskState;
  title: ReactNode;
  description?: ReactNode;
  progress?: number;
  errorMessage?: ReactNode;
  onRetry?: () => void | Promise<void>;
  retryText?: string;
};

const stateMeta: Record<AdminAsyncTaskState, { label: string; icon: ReactNode }> = {
  waiting: { label: '正在排队', icon: <ClockCircleOutlined /> },
  running: { label: '正在处理', icon: <LoadingOutlined spin /> },
  success: { label: '处理完成', icon: <CheckCircleFilled /> },
  error: { label: '处理失败', icon: <CloseCircleFilled /> }
};

export function AdminAsyncTaskStatus({
  state,
  title,
  description,
  progress,
  errorMessage,
  onRetry,
  retryText = '重试'
}: AdminAsyncTaskStatusProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const meta = stateMeta[state];
  const canRetry = state === 'error' && Boolean(onRetry) && !isRetrying;
  const showProgress = state === 'running' && typeof progress === 'number';

  const handleRetry = async () => {
    if (!onRetry || !canRetry) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <section className={`admin-async-task-status is-${state}`} aria-live="polite">
      <span className="admin-async-task-status__icon" aria-hidden="true">{meta.icon}</span>
      <div className="admin-async-task-status__content">
        <div className="admin-async-task-status__heading">
          <strong>{title}</strong>
          <span>{meta.label}</span>
        </div>
        {description ? <p>{description}</p> : null}
        {showProgress ? (
          <AdminProgress
            percent={Math.min(Math.max(progress, 0), 100)}
            size="small"
            strokeColor="#1f6fff"
          />
        ) : null}
        {state === 'error' && errorMessage ? <p className="admin-async-task-status__error">{errorMessage}</p> : null}
      </div>
      {canRetry || isRetrying ? (
        <AdminTextAction loading={isRetrying} onClick={handleRetry}>{retryText}</AdminTextAction>
      ) : null}
    </section>
  );
}
