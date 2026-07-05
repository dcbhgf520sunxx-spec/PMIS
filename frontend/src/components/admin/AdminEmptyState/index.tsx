import type { ReactNode } from 'react';
import { Empty } from 'antd';
import './index.css';

type AdminEmptyStateProps = {
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function AdminEmptyState({
  description = '暂无数据',
  children,
  className
}: AdminEmptyStateProps) {
  return (
    <Empty
      className={['admin-empty-state', className].filter(Boolean).join(' ')}
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={description}
    >
      {children}
    </Empty>
  );
}
