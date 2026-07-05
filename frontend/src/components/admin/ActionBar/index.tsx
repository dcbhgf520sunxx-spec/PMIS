import type { ReactNode } from 'react';
import { Space } from 'antd';

export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <Space size={8} wrap>
      {children}
    </Space>
  );
}
