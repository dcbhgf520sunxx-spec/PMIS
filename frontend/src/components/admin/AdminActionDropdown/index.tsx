import type { ReactNode } from 'react';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { AdminTextAction } from '../AdminTextAction';

export type AdminActionDropdownItem = {
  key: string;
  label: ReactNode;
  danger?: boolean;
  disabled?: boolean;
};

type AdminActionDropdownProps = {
  items: AdminActionDropdownItem[];
  children?: ReactNode;
  disabled?: boolean;
  onClick: (key: string) => void;
};

export function AdminActionDropdown({
  items,
  children = '更多',
  disabled,
  onClick
}: AdminActionDropdownProps) {
  const menuItems: MenuProps['items'] = items.map((item) => ({
    key: item.key,
    label: item.label,
    danger: item.danger,
    disabled: item.disabled
  }));

  return (
    <Dropdown
      trigger={['click']}
      disabled={disabled}
      menu={{
        items: menuItems,
        onClick: ({ key }) => onClick(String(key))
      }}
    >
      <AdminTextAction disabled={disabled}>{children}</AdminTextAction>
    </Dropdown>
  );
}
