import type { ComponentProps } from 'react';
import { Select } from 'antd';
import { AdminSelect } from '../AdminSelect';

const userOptions = [
  { label: '管理员', value: '1' },
  { label: '运维人员', value: '2' },
  { label: '普通用户', value: '3' }
];

export function UserSelect(props: ComponentProps<typeof Select>) {
  return (
    <AdminSelect
      options={userOptions}
      {...props}
    />
  );
}
