import type { ReactNode } from 'react';
import './index.css';

type TableFooterBarProps = {
  actions?: ReactNode;
  extra?: ReactNode;
  selectedCount?: number;
};

export function TableFooterBar({ actions, extra, selectedCount }: TableFooterBarProps) {
  return (
    <div className="admin-table-footer-bar">
      {actions || typeof selectedCount === 'number' ? (
        <div className="admin-table-footer-bar__actions">
          {actions}
          {typeof selectedCount === 'number' ? (
            <span className="admin-table-footer-bar__selected-count">
              已选择 {selectedCount} 项
            </span>
          ) : null}
        </div>
      ) : null}
      {extra ? (
        <div className="admin-table-footer-bar__extra">
          {extra}
        </div>
      ) : null}
    </div>
  );
}
