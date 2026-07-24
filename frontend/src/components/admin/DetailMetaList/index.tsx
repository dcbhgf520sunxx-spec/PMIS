import { Tooltip } from 'antd';
import type { ReactNode } from 'react';
import './index.css';
import { normalizeDetailMetaValue } from './normalizeValue';

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
        const value = normalizeDetailMetaValue(item.value);
        const isTextValue = typeof value === 'string' || typeof value === 'number';
        const shouldClamp = !item.longText && (item.aggregate || isTextValue);
        const valueClassName = item.longText ? 'is-long-text' : shouldClamp ? 'is-clamped' : undefined;
        const valueNode = <dd className={valueClassName}>{value}</dd>;
        return (
          <div className={item.wide ? 'admin-detail-meta-list__item is-wide' : 'admin-detail-meta-list__item'} key={item.label}>
            <dt>{item.label}</dt>
            {shouldClamp ? <Tooltip title={value}>{valueNode}</Tooltip> : valueNode}
          </div>
        );
      })}
    </dl>
  );
}
