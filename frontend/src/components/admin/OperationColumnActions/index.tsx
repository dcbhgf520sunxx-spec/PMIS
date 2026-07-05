import type { ReactNode } from 'react';
import { TableActions } from '../TableActions';

type OperationColumnActionsProps = {
  children: ReactNode;
};

export function OperationColumnActions({ children }: OperationColumnActionsProps) {
  return (
    <TableActions>
      {children}
    </TableActions>
  );
}
