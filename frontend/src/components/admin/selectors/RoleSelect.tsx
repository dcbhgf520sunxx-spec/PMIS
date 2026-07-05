import type { ComponentProps } from 'react';
import { Select } from 'antd';
import { AdminSelect } from '../AdminSelect';

const roleOptions = [
  { label: '管理员', value: 'admin' },
  { label: '运维人员', value: 'ops' },
  { label: '普通用户', value: 'user' }
];

export function RoleSelect(props: ComponentProps<typeof Select>) {
  return (
    <AdminSelect
      options={roleOptions}
      {...props}
    />
  );
}
