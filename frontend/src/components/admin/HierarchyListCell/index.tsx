import type { ReactNode } from 'react';
import { AdminTag } from '../AdminPrimitives';
import { CategoryTag, defineCategoryToneMap } from '../CategoryTag';
import { ExpandToggleButton } from '../ExpandToggleButton';
import './index.css';

const hierarchyLevelTones = defineCategoryToneMap({ parent: 'indigo' });

export type HierarchyListCellProps = {
  children: ReactNode;
  level?: 'parent' | 'child';
  hasChildren?: boolean;
  expanded?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
  onToggle?: () => void;
  trailing?: ReactNode;
  className?: string;
};

export function HierarchyListCell({
  children,
  level,
  hasChildren = false,
  expanded = false,
  expandLabel,
  collapseLabel,
  onToggle,
  trailing,
  className
}: HierarchyListCellProps) {
  return (
    <div className={[
      'admin-hierarchy-list-cell',
      level === 'child' ? 'is-child' : '',
      className
    ].filter(Boolean).join(' ')}>
      {hasChildren ? (
        <ExpandToggleButton
          className="admin-hierarchy-list-cell__toggle"
          variant="square"
          expanded={expanded}
          expandLabel={expandLabel}
          collapseLabel={collapseLabel}
          onClick={onToggle}
        />
      ) : null}
      {level === 'parent' ? <CategoryTag tone={hierarchyLevelTones.parent}>主</CategoryTag> : null}
      {level === 'child' ? <AdminTag>子</AdminTag> : null}
      <div className="admin-hierarchy-list-cell__content">{children}</div>
      {trailing ? <div className="admin-hierarchy-list-cell__trailing">{trailing}</div> : null}
    </div>
  );
}
