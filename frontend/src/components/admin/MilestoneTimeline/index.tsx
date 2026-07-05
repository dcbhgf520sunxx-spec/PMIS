import { Timeline } from 'antd';
import { CheckCircleFilled, ClockCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import './index.css';

export type MilestoneStatus = 'pending' | 'processing' | 'done' | 'blocked';

export type MilestoneItem = {
  id: string;
  name: string;
  plannedDate?: string;
  actualDate?: string;
  status: MilestoneStatus;
  description?: string;
  overdueDays?: number;
};

const statusMeta = {
  pending: { label: '未开始', color: '#94a3b8', icon: <ClockCircleFilled /> },
  processing: { label: '进行中', color: '#2563eb', icon: <ClockCircleFilled /> },
  done: { label: '已完成', color: '#16a34a', icon: <CheckCircleFilled /> },
  blocked: { label: '阻塞', color: '#dc2626', icon: <CloseCircleFilled /> }
};

export function MilestoneTimeline({ items }: { items: MilestoneItem[] }) {
  return (
    <Timeline
      className="admin-milestone-timeline"
      items={items.map((item) => {
        const meta = statusMeta[item.status];
        return {
          key: item.id,
          dot: <span className="admin-milestone-timeline__dot" style={{ color: meta.color }}>{meta.icon}</span>,
          children: (
            <div className="admin-milestone-timeline__content">
              <div className="admin-milestone-timeline__title">
                <strong>{item.name}</strong>
                <span style={{ color: meta.color }}>{meta.label}</span>
                {item.overdueDays ? <em>逾期 {item.overdueDays} 天</em> : null}
              </div>
              <div className="admin-milestone-timeline__dates">
                <span>计划：{item.plannedDate || '-'}</span>
                <span>实际：{item.actualDate || '-'}</span>
              </div>
              {item.description ? <div className="admin-milestone-timeline__desc">{item.description}</div> : null}
            </div>
          )
        };
      })}
    />
  );
}
