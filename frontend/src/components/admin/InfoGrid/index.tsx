import { Empty } from 'antd';
import './index.css';

export type InfoGridItem = {
  label: React.ReactNode;
  value?: React.ReactNode;
  span?: 1 | 2 | 3 | 4;
};

type InfoGridProps = {
  items: InfoGridItem[];
  columns?: 2 | 3 | 4;
  emptyText?: string;
};

export function InfoGrid({ items, columns = 3, emptyText = '-' }: InfoGridProps) {
  if (items.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无信息" />;
  }

  return (
    <div className={`admin-info-grid admin-info-grid--${columns}`}>
      {items.map((item, index) => (
        <div
          className="admin-info-grid__item"
          style={{ gridColumn: item.span ? `span ${item.span}` : undefined }}
          key={`${String(item.label)}-${index}`}
        >
          <div className="admin-info-grid__label">{item.label}</div>
          <div className="admin-info-grid__value">{item.value ?? emptyText}</div>
        </div>
      ))}
    </div>
  );
}
