import { Tooltip } from 'antd';
import type { ReactNode } from 'react';
import './index.css';

export type DetailMetaItem = {
  label: string;
  value: ReactNode;
  wide?: boolean;
  aggregate?: boolean;
  longText?: boolean;
};

type DetailMetaListProps = {
  items: DetailMetaItem[];
  columns?: 2 | 3 | 4;
};

export function DetailMetaList({ items, columns = 4 }: DetailMetaListProps) {
  return (
    <dl className={`admin-detail-meta-list is-columns-${columns}`}>
      {items.map((item) => {
        const isTextValue = typeof item.value === 'string' || typeof item.value === 'number';
        const shouldClamp = !item.longText && (item.aggregate || isTextValue);
        const valueNode = <dd className={shouldClamp ? 'is-clamped' : undefined}>{item.value}</dd>;
        return (
          <div className={item.wide ? 'admin-detail-meta-list__item is-wide' : 'admin-detail-meta-list__item'} key={item.label}>
            <dt>{item.label}</dt>
            {shouldClamp ? <Tooltip title={item.value}>{valueNode}</Tooltip> : valueNode}
          </div>
        );
      })}
    </dl>
  );
}
