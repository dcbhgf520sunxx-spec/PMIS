import type { ReactNode } from 'react';
import type { DataListPageProps } from '../DataListPage';
import { DataListPage } from '../DataListPage';
import { PageShell } from '../PageShell';
import { TablePagination } from '../TablePagination';
import { useListPageData } from '../DataListPage/useListPageData';

type TemplateListPagination = {
  current: number;
  pageSize: number;
  total: number;
  onChange: (page: number, pageSize: number) => void;
  onShowSizeChange: (current: number, size: number) => void;
};

type TemplateListPageBaseProps<
  T extends Record<string, unknown>,
  P extends Record<string, unknown> = Record<string, unknown>
> = Omit<DataListPageProps<T, P>, 'footerExtra' | 'footerActions' | 'selectedCount'> & {
  title: string;
  titleExtra?: ReactNode;
  actions?: ReactNode;
  pagination: TemplateListPagination;
};

type TemplateListStandardMode = {
  mode?: 'standard';
};

type TemplateListBatchMode = {
  mode: 'batch';
  batch: {
    selectedCount: number;
    actions: ReactNode;
  };
};

type TemplateListPageProps<
  T extends Record<string, unknown>,
  P extends Record<string, unknown> = Record<string, unknown>
> = TemplateListPageBaseProps<T, P> & (TemplateListStandardMode | TemplateListBatchMode);

export function TemplateListPage<
  T extends Record<string, unknown>,
  P extends Record<string, unknown> = Record<string, unknown>
>(props: TemplateListPageProps<T, P>) {
  const {
    title,
    titleExtra,
    actions,
    pagination,
    mode,
    ...restProps
  } = props;
  const dataListProps = { ...restProps } as TemplateListPageBaseProps<T, P> & { batch?: TemplateListBatchMode['batch'] };
  delete dataListProps.batch;
  const batchProps = mode === 'batch'
    ? {
      selectedCount: props.batch.selectedCount,
      footerActions: props.batch.actions
    }
    : {};

  return (
    <PageShell title={title} compact titleExtra={titleExtra} actions={actions}>
      <DataListPage<T, P>
        {...dataListProps as Omit<DataListPageProps<T, P>, 'footerExtra'>}
        {...batchProps}
        footerExtra={(
          <TablePagination
            current={pagination.total === 0 ? 1 : pagination.current}
            pageSize={pagination.pageSize}
            total={pagination.total}
            onChange={pagination.onChange}
            onShowSizeChange={pagination.onShowSizeChange}
          />
        )}
      />
    </PageShell>
  );
}

export const useTemplateListPageData = useListPageData;
export { useCommittedFilters } from './useCommittedFilters';
