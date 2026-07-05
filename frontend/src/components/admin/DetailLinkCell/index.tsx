import type { ReactNode } from 'react';
import { AdminTextAction } from '../AdminTextAction';

type DetailLinkCellProps = {
  children: ReactNode;
  title?: string;
  className?: string;
  onClick: () => void;
};

export function DetailLinkCell({ children, title, className, onClick }: DetailLinkCellProps) {
  return (
    <AdminTextAction className={className} title={title} onClick={onClick}>
      {children}
    </AdminTextAction>
  );
}
