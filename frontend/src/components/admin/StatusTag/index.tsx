import type { ReactNode } from 'react';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { Tag } from 'antd';
import './index.css';

type StatusType = 'enabled' | 'disabled' | 'pending' | 'processing' | 'success' | 'error';

const statusMap: Record<StatusType, { tone: string; text: string; icon: ReactNode }> = {
  enabled: { tone: 'positive', text: '启用', icon: <CheckCircleOutlined /> },
  disabled: { tone: 'neutral', text: '停用', icon: <CloseCircleOutlined /> },
  pending: { tone: 'pending', text: '待处理', icon: <ClockCircleOutlined /> },
  processing: { tone: 'processing', text: '处理中', icon: <SyncOutlined /> },
  success: { tone: 'positive', text: '成功', icon: <CheckCircleOutlined /> },
  error: { tone: 'danger', text: '失败', icon: <CloseCircleOutlined /> }
};

export function StatusTag({ status, text }: { status: StatusType; text?: string }) {
  const config = statusMap[status];

  return (
    <Tag icon={config.icon} className={`admin-status-tag admin-status-tag--${config.tone}`}>
      {text || config.text}
    </Tag>
  );
}
