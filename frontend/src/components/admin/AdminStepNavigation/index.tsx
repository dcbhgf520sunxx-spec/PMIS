import { Steps } from 'antd';
import type { ComponentProps } from 'react';
import './index.css';

export type AdminStepNavigationProps = ComponentProps<typeof Steps>;

export function AdminStepNavigation({ className, ...props }: AdminStepNavigationProps) {
  return <Steps {...props} className={['admin-step-navigation', className].filter(Boolean).join(' ')} responsive />;
}
