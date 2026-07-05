import type { ReactNode } from 'react';
import './index.css';

export type DetailMetaItem = {
  label: string;
  value: ReactNode;
  wide?: boolean;
};

type DetailMetaListProps = {
  items: DetailMetaItem[];
  columns?: 2 | 3 | 4;
};

export function DetailMetaList({ items, columns = 4 }: DetailMetaListProps) {
  return (
    <dl className={`admin-detail-meta-list is-columns-${columns}`}>
      {items.map((item) => (
        <div className={item.wide ? 'admin-detail-meta-list__item is-wide' : 'admin-detail-meta-list__item'} key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
