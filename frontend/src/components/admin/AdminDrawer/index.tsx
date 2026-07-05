import type { ComponentProps } from 'react';
import { Drawer } from 'antd';
import './index.css';

type AdminDrawerProps = ComponentProps<typeof Drawer>;

export function AdminDrawer({ className, rootClassName, ...props }: AdminDrawerProps) {
  return (
    <Drawer
      {...props}
      rootClassName={['admin-drawer-root', rootClassName].filter(Boolean).join(' ')}
      className={['admin-drawer', className].filter(Boolean).join(' ')}
    />
  );
}
