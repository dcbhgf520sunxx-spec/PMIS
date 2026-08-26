import type { ReactNode } from 'react';
import { Timeline } from 'antd';
import { AdminEmptyState } from '../AdminEmptyState';
import './index.css';

export type ActivityTimelineItem = {
  id: string;
  title: ReactNode;
  time: string;
  description: ReactNode;
  meta?: ReactNode;
  extra?: ReactNode;
};

type ActivityTimelineProps = {
  items: ActivityTimelineItem[];
  emptyDescription?: string;
};

export function ActivityTimeline({ items, emptyDescription = '暂无记录' }: ActivityTimelineProps) {
  if (items.length === 0) return <AdminEmptyState description={emptyDescription} />;

  return (
    <Timeline
      className="admin-activity-timeline"
      items={items.map((item) => ({
        key: item.id,
        children: (
          <div className="admin-activity-timeline__item">
            <div className="admin-activity-timeline__header">
              <div className="admin-activity-timeline__title">
                <strong>{item.title}</strong>
                <span>·</span>
                <span>{item.time}</span>
              </div>
              {item.extra ? <div className="admin-activity-timeline__extra">{item.extra}</div> : null}
            </div>
            {item.meta ? <div className="admin-activity-timeline__meta">{item.meta}</div> : null}
            <div className="admin-activity-timeline__description">{item.description}</div>
          </div>
        )
      }))}
    />
  );
}
