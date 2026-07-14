import type { ReactNode } from 'react';
import { Alert } from 'antd';
import { AdminButton } from '../AdminPrimitives';
import type { DataListPageProps } from '../DataListPage';
import { DataListPage } from '../DataListPage';
import { PageShell } from '../PageShell';
import { TablePagination } from '../TablePagination';
import { useListPageData } from '../DataListPage/useListPageData';
import { useListScrollRestoration } from './useListScrollRestoration';

export type TemplateListPagination = {
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
  title?: string;
  titleExtra?: ReactNode;
  actions?: ReactNode;
  pagination: TemplateListPagination;
  embedded?: boolean;
  error?: string;
  onRetry?: () => void;
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

export type TemplateListPageProps<
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
    embedded,
    error,
    onRetry,
    ...restProps
  } = props;
  useListScrollRestoration(!embedded);
  const dataListProps = { ...restProps } as TemplateListPageBaseProps<T, P> & { batch?: TemplateListBatchMode['batch'] };
  delete dataListProps.batch;
  delete dataListProps.error;
  delete dataListProps.onRetry;
  const batchProps = mode === 'batch'
    ? {
      selectedCount: props.batch.selectedCount,
      footerActions: props.batch.actions
    }
    : {};

  const content = error ? (
    <Alert
      type="error"
      showIcon
      message="列表加载失败"
      description={error}
      action={onRetry ? <AdminButton type="primary" onClick={onRetry}>重新加载</AdminButton> : undefined}
    />
  ) : (
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
  );

  if (embedded) return content;

  return (
    <PageShell title={title || ''} compact titleExtra={titleExtra} actions={actions}>
      {content}
    </PageShell>
  );
}

export const useTemplateListPageData = useListPageData;
export { useCommittedFilters } from './useCommittedFilters';
export { useListViewState } from './useListViewState';
export * from './listRouteState';
