import { forwardRef } from 'react';
import type { ComponentProps, ComponentRef } from 'react';
import { Button } from 'antd';
import { usePermission } from '../../../hooks/usePermission';

type PermissionButtonProps = ComponentProps<typeof Button> & {
  permission?: string;
  unauthorizedMode?: 'hidden' | 'disabled';
};

export const PermissionButton = forwardRef<ComponentRef<typeof Button>, PermissionButtonProps>(function PermissionButton({
  permission,
  unauthorizedMode = 'hidden',
  disabled,
  ...props
}, ref) {
  const allowed = usePermission(permission);

  if (!allowed && unauthorizedMode === 'hidden') return null;

  return <Button ref={ref} disabled={disabled || !allowed} {...props} />;
});
