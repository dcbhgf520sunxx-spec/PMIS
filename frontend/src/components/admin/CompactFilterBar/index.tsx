import type { ReactNode } from 'react';
import { Button, Space } from 'antd';
import './index.css';

export type CompactFilterItem = {
  key: string;
  label: string;
  node: ReactNode;
  wide?: boolean;
};

type CompactFilterBarProps = {
  items: CompactFilterItem[];
  expanded?: boolean;
  visibleCount?: number;
  onExpandChange?: (expanded: boolean) => void;
  onSearch?: () => void;
  onReset?: () => void;
};

export function CompactFilterBar({
  items,
  expanded = false,
  visibleCount = 5,
  onExpandChange,
  onSearch,
  onReset
}: CompactFilterBarProps) {
  const visibleItems = expanded ? items : items.slice(0, visibleCount);
  const canExpand = items.length > visibleCount;

  return (
    <div className={expanded ? 'admin-compact-filter is-expanded' : 'admin-compact-filter'}>
      <div className="admin-compact-filter__grid">
        <div className="admin-compact-filter__fields">
          {visibleItems.map((item) => (
            <label
              key={item.key}
              className={item.wide ? 'admin-compact-filter__item is-wide' : 'admin-compact-filter__item'}
            >
              <span className="admin-compact-filter__label">{item.label}：</span>
              <span className="admin-compact-filter__control">{item.node}</span>
            </label>
          ))}
        </div>
        <Space className="admin-compact-filter__actions" size={8}>
          <Button onClick={onReset}>重置</Button>
          <Button type="primary" onClick={onSearch}>查询</Button>
          {canExpand ? (
            <Button type="link" onClick={() => onExpandChange?.(!expanded)}>
              {expanded ? '收起' : '展开'}
            </Button>
          ) : null}
        </Space>
      </div>
    </div>
  );
}
