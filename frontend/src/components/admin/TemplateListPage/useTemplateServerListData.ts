import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useListPageData } from '../DataListPage/useListPageData';

type SortOrder = 'ascend' | 'descend';

export type TemplateServerListRequest = {
  current: number;
  pageSize: number;
  sortField?: string;
  sortOrder?: SortOrder;
};

export type TemplateServerListResult<T, M = undefined> = {
  list: T[];
  total: number;
  meta?: M;
};

type UseTemplateServerListDataOptions<T extends Record<string, unknown>, M> = {
  queryKey: readonly unknown[];
  request: (params: TemplateServerListRequest) => Promise<TemplateServerListResult<T, M>>;
  sorters?: Record<string, (a: T, b: T) => number>;
  defaultPageSize?: number;
  urlSync?: boolean;
};

export function useTemplateServerListData<T extends Record<string, unknown>, M = undefined>({
  queryKey,
  request,
  sorters,
  defaultPageSize,
  urlSync = false
}: UseTemplateServerListDataOptions<T, M>) {
  const queryContextSignature = JSON.stringify(queryKey);
  const previousQueryContextRef = useRef(queryContextSignature);
  const pendingQueryContextRef = useRef<string>();
  const queryContextChanged = previousQueryContextRef.current !== queryContextSignature;
  const listData = useListPageData<T>({
    rows: [],
    sorters,
    defaultPageSize,
    total: 0,
    serverPaging: true,
    urlSync
  });
  const { currentPage, pageSize, setCurrentPage, sortState } = listData;
  const pendingQueryReset = queryContextChanged || pendingQueryContextRef.current === queryContextSignature;
  const requestPage = pendingQueryReset ? 1 : currentPage;
  const serverQueryKey = useMemo(() => [
    'template-server-list',
    ...queryKey,
    requestPage,
    pageSize,
    sortState.field,
    sortState.order
  ], [queryKey, requestPage, pageSize, sortState.field, sortState.order]);
  const query = useQuery({
    queryKey: serverQueryKey,
    queryFn: () => request({
      current: requestPage,
      pageSize,
      sortField: sortState.field,
      sortOrder: sortState.order
    })
  });
  useEffect(() => {
    if (queryContextChanged) {
      previousQueryContextRef.current = queryContextSignature;
      pendingQueryContextRef.current = currentPage === 1 ? undefined : queryContextSignature;
      if (currentPage !== 1) setCurrentPage(1);
      return;
    }
    if (pendingQueryContextRef.current === queryContextSignature && currentPage === 1) {
      pendingQueryContextRef.current = undefined;
    }
  }, [currentPage, queryContextChanged, queryContextSignature, setCurrentPage]);

  const rows = query.data?.list ?? [];
  const total = query.data?.total ?? 0;

  useEffect(() => {
    if (!query.data) return;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    if (requestPage > maxPage) setCurrentPage(maxPage);
  }, [pageSize, query.data, requestPage, setCurrentPage, total]);

  return {
    ...listData,
    pagedRows: rows,
    sortedRows: rows,
    total,
    pagination: {
      ...listData.pagination,
      current: requestPage,
      total
    },
    loading: query.isPending || query.isFetching,
    error: query.error instanceof Error ? query.error.message : query.error ? '请求失败，请稍后重试' : '',
    meta: query.data?.meta,
    reload: async () => {
      await query.refetch({ throwOnError: true });
    }
  };
}
