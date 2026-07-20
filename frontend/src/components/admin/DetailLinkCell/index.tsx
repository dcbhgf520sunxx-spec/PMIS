import type { ReactNode } from 'react';
import { AdminTextAction } from '../AdminTextAction';
import { getListCellTitle } from '../SearchTable/listCellTitle';

type DetailLinkCellProps = {
  children: ReactNode;
  title?: string;
  className?: string;
  onClick: () => void;
};

export function DetailLinkCell({ children, title, className, onClick }: DetailLinkCellProps) {
  const resolvedTitle = title ?? getListCellTitle(children);

  return (
    <AdminTextAction className={className} title={resolvedTitle} onClick={onClick}>
      {children}
    </AdminTextAction>
  );
}
