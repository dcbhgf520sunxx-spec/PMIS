import { Empty, Timeline } from 'antd';

type OperationLogItem = {
  id: string;
  operator: string;
  action: string;
  time: string;
  detail?: string;
};

export function OperationLog({ items }: { items: OperationLogItem[] }) {
  if (items.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作日志" />;
  }

  return (
    <Timeline
      items={items.map((item) => ({
        key: item.id,
        children: (
          <div>
            <strong>{item.action}</strong>
            <div>
              {item.operator} · {item.time}
            </div>
            {item.detail ? <div>{item.detail}</div> : null}
          </div>
        )
      }))}
    />
  );
}
