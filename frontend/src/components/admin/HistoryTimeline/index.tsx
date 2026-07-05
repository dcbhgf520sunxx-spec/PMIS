import { useState } from 'react';
import type { ReactNode } from 'react';
import { Empty, Timeline } from 'antd';
import { richTextToSummary } from '../../../utils/richText';
import { ExpandToggleButton } from '../ExpandToggleButton';
import './index.css';

export type HistoryChange = {
  field: string;
  before?: ReactNode;
  after?: ReactNode;
};

export type HistoryTimelineItem = {
  id: string;
  operator: string;
  action: string;
  time: string;
  remark?: string;
  changes?: HistoryChange[];
};

type HistoryTimelineProps = {
  items: HistoryTimelineItem[];
  expandedKeys?: string[];
  onExpandedKeysChange?: (keys: string[]) => void;
};

function formatHistoryValue(field: string, value?: ReactNode) {
  if (typeof value !== 'string') return value ?? '-';
  if (field === '问题描述') return richTextToSummary(value) || '-';
  return value || '-';
}

export function HistoryTimeline({ items, expandedKeys, onExpandedKeysChange }: HistoryTimelineProps) {
  const [innerExpandedKeys, setInnerExpandedKeys] = useState<string[]>([]);
  const currentExpandedKeys = expandedKeys ?? innerExpandedKeys;
  const updateExpandedKeys = onExpandedKeysChange ?? setInnerExpandedKeys;

  if (items.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史记录" />;
  }

  const toggleExpanded = (id: string) => {
    updateExpandedKeys(
      currentExpandedKeys.includes(id)
        ? currentExpandedKeys.filter((item) => item !== id)
        : [...currentExpandedKeys, id]
    );
  };

  return (
    <Timeline
      className="admin-history-timeline"
      items={items.map((item) => ({
        key: item.id,
        children: (
          <div className="admin-history-timeline__item">
            <div className="admin-history-timeline__header">
              <div className="admin-history-timeline__title">
                <strong>{item.action}</strong>
                <span>{item.operator} · {item.time}</span>
                {item.changes?.length ? (
                  <ExpandToggleButton
                    collapseLabel="收起变更详情"
                    expandLabel="展开变更详情"
                    expanded={currentExpandedKeys.includes(item.id)}
                    onClick={() => toggleExpanded(item.id)}
                  />
                ) : null}
              </div>
            </div>
            {item.changes?.length && currentExpandedKeys.includes(item.id) ? (
              <div className="admin-history-timeline__changes">
                {item.changes.map((change, index) => (
                  <div className="admin-history-timeline__change" key={`${change.field}-${index}`}>
                    <span>{change.field}：</span>
                    <span className="admin-history-timeline__value is-before" title={typeof change.before === 'string' ? formatHistoryValue(change.field, change.before) as string : undefined}>
                      {formatHistoryValue(change.field, change.before)}
                    </span>
                    <span className="admin-history-timeline__arrow"> → </span>
                    <strong title={typeof change.after === 'string' ? formatHistoryValue(change.field, change.after) as string : undefined}>
                      {formatHistoryValue(change.field, change.after)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )
      }))}
    />
  );
}
