import type { ReactNode } from 'react';
import { Space } from 'antd';

type TableActionsProps = {
  children: ReactNode;
};

export function TableActions({ children }: TableActionsProps) {
  return (
    <Space size={10} wrap={false}>
      {children}
    </Space>
  );
}
