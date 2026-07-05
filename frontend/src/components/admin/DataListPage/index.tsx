import type { ReactNode } from 'react';
import type { SearchTableProps } from '../SearchTable';
import { SearchTable } from '../SearchTable';
import { TableFooterBar } from '../TableFooterBar';
import { useDataListScrollY } from './useDataListScrollY';
import './index.css';

export type DataListPageProps<
  T extends Record<string, unknown>,
  P extends Record<string, unknown> = Record<string, unknown>
> = {
  filter?: ReactNode;
  table: SearchTableProps<T, P>;
  footerActions?: ReactNode;
  footerExtra?: ReactNode;
  selectedCount?: number;
  scrollYDeps?: unknown[];
};

export function DataListPage<
  T extends Record<string, unknown>,
  P extends Record<string, unknown> = Record<string, unknown>
>({
  filter,
  table,
  footerActions,
  footerExtra,
  selectedCount,
  scrollYDeps = []
}: DataListPageProps<T, P>) {
  const { className, scroll, tableRender, ...tableProps } = table;
  const { containerRef, scrollY } = useDataListScrollY(scrollYDeps);

  return (
    <div className="admin-data-list-page">
      {filter}
      <div ref={containerRef} className="admin-data-list-page__table">
        <SearchTable<T, P>
          {...tableProps}
          className={['admin-data-list-page__table-card', className].filter(Boolean).join(' ')}
          scroll={{ ...scroll, y: scrollY }}
          tableRender={(props, dom, domList) => {
            const tableDom = tableRender ? tableRender(props, dom, domList) : dom;

            return (
              <div className="admin-data-list-page__table-frame">
                <div className="admin-data-list-page__table-body">
                  {tableDom}
                </div>
                <TableFooterBar
                  selectedCount={selectedCount}
                  extra={footerExtra}
                  actions={footerActions}
                />
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
