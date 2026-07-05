import type { ReactNode } from 'react';
import { Descriptions } from 'antd';

type DetailColumn<T extends Record<string, unknown>> = {
  title: string;
  dataIndex: keyof T;
  render?: (value: T[keyof T], record: T) => ReactNode;
};

type DetailPageProps<T extends Record<string, unknown>> = {
  data: T;
  columns: DetailColumn<T>[];
};

export function DetailPage<T extends Record<string, unknown>>({
  data,
  columns
}: DetailPageProps<T>) {
  return (
    <Descriptions
      bordered
      column={2}
      size="small"
      items={columns.map((column) => ({
        key: String(column.dataIndex),
        label: column.title,
        children: column.render
          ? column.render(data[column.dataIndex], data)
          : String(data[column.dataIndex] ?? '-')
      }))}
    />
  );
}
