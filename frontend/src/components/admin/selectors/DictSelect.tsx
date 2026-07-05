import type { ComponentProps } from 'react';
import { Select } from 'antd';
import { AdminSelect } from '../AdminSelect';

const dictOptions = [
  { label: '默认', value: 'default' },
  { label: '重点', value: 'important' },
  { label: '归档', value: 'archived' }
];

export function DictSelect(props: ComponentProps<typeof Select>) {
  return (
    <AdminSelect
      options={dictOptions}
      {...props}
    />
  );
}
