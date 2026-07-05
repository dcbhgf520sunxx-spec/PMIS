import { Button } from 'antd';
import type { ButtonProps } from 'antd';
import { forwardRef } from 'react';
import type { ComponentRef } from 'react';

type AdminTextActionProps = Omit<ButtonProps, 'type' | 'size' | 'danger'> & {
  danger?: boolean;
};

export const AdminTextAction = forwardRef<ComponentRef<typeof Button>, AdminTextActionProps>(function AdminTextAction({
  className,
  danger,
  children,
  ...props
}, ref) {
  const actionClassName = ['admin-text-action', danger ? 'is-danger' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <Button
      ref={ref}
      {...props}
      className={actionClassName}
      size="small"
      type="link"
    >
      {children}
    </Button>
  );
});
