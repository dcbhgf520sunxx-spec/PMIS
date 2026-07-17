import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { SearchTableProps } from '../SearchTable';
import { decodeListRouteState, encodeListRouteState } from '../TemplateListPage/listRouteState';

type SortOrder = 'ascend' | 'descend';

type SortState = {
  field?: string;
  order?: SortOrder;
};

type UseListPageDataOptions<T extends Record<string, unknown>> = {
  rows: T[];
  sorters?: Record<string, (a: T, b: T) => number>;
  defaultPageSize?: number;
  resetOn?: unknown[];
  total?: number;
  serverPaging?: boolean;
  urlSync?: boolean;
};

type TableSorter = {
  field?: string | number | readonly (string | number)[];
  order?: SortOrder | null;
};

function normalizeSorter(sorter: unknown): SortState {
  const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
  if (!activeSorter || typeof activeSorter !== 'object') return {};

  const { field, order } = activeSorter as TableSorter;
  const normalizedField = Array.isArray(field)
    ? field.join('.')
    : field !== undefined ? String(field) : undefined;

  return order && normalizedField ? { field: normalizedField, order } : {};
}

function getStoredDefaultPageSize() {
  const fallback = 20;
  const raw = localStorage.getItem('user_preference');
  if (!raw) return fallback;

  try {
    const pageSize = Number(JSON.parse(raw)?.default_page_size || fallback);
    return [10, 20, 50, 100].includes(pageSize) ? pageSize : fallback;
  } catch {
    return fallback;
  }
}

export function useListPageData<T extends Record<string, unknown>>({
  rows,
  sorters = {},
  defaultPageSize = getStoredDefaultPageSize(),
  resetOn = [],
  total,
  serverPaging = false,
  urlSync = false
}: UseListPageDataOptions<T>) {
  const location = useLocation();
  const navigate = useNavigate();
  const readRouteState = useCallback(
    () => decodeListRouteState(location.search, { pageSize: defaultPageSize }),
    [defaultPageSize, location.search]
  );
  const initial = readRouteState();
  const [currentPage, setCurrentPageState] = useState(urlSync ? initial.page : 1);
  const [pageSize, setPageSizeState] = useState(urlSync ? initial.pageSize : defaultPageSize);
  const [sortState, setSortStateState] = useState<SortState>(urlSync ? {
    field: initial.sortField,
    order: initial.sortOrder
  } : {});
  const resetMountedRef = useRef(false);

  const syncRoute = useCallback((next: Partial<{ page: number; pageSize: number; sortState: SortState }>) => {
    if (!urlSync) return;
    const route = decodeListRouteState(location.search, { pageSize: defaultPageSize });
    const nextSort = next.sortState || { field: route.sortField, order: route.sortOrder };
    const search = encodeListRouteState(location.search, {
      ...route,
      page: next.page ?? route.page,
      pageSize: next.pageSize ?? route.pageSize,
      sortField: nextSort.field,
      sortOrder: nextSort.order
    }, { pageSize: defaultPageSize });
    if (search !== location.search) navigate(`${location.pathname}${search}${location.hash}`);
  }, [defaultPageSize, location.hash, location.pathname, location.search, navigate, urlSync]);

  const setCurrentPage = useCallback((page: number) => {
    setCurrentPageState(page);
    syncRoute({ page });
  }, [syncRoute]);
  const setCurrentPageRef = useRef(setCurrentPage);

  useEffect(() => {
    setCurrentPageRef.current = setCurrentPage;
  }, [setCurrentPage]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    syncRoute({ pageSize: size });
  }, [syncRoute]);
  const setSortState = useCallback((state: SortState) => {
    setSortStateState(state);
    syncRoute({ sortState: state });
  }, [syncRoute]);

  useEffect(() => {
    if (!urlSync) return;
    const route = readRouteState();
    setCurrentPageState(route.page);
    setPageSizeState(route.pageSize);
    setSortStateState({ field: route.sortField, order: route.sortOrder });
  }, [readRouteState, urlSync]);

  const sortedRows = useMemo(() => {
    if (serverPaging) return rows;
    if (!sortState.field || !sortState.order) return rows;

    const sorter = sorters[sortState.field];
    if (!sorter) return rows;

    return [...rows].sort((a, b) => {
      const result = sorter(a, b);
      return sortState.order === 'ascend' ? result : -result;
    });
  }, [rows, serverPaging, sortState, sorters]);

  useEffect(() => {
    if (serverPaging && total === 0 && rows.length === 0) return;
    const maxPage = Math.max(1, Math.ceil((serverPaging ? total || 0 : sortedRows.length) / pageSize));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [currentPage, pageSize, rows.length, serverPaging, setCurrentPage, sortedRows.length, total]);

  const resetKey = JSON.stringify(resetOn);

  useEffect(() => {
    if (!resetMountedRef.current) {
      resetMountedRef.current = true;
      return;
    }
    setCurrentPageRef.current(1);
  }, [resetKey]);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return serverPaging ? sortedRows : sortedRows.slice(start, start + pageSize);
  }, [currentPage, pageSize, serverPaging, sortedRows]);

  const handleTableChange: NonNullable<SearchTableProps<T>['onChange']> = (_, __, sorter) => {
    const nextSort = normalizeSorter(sorter);
    setSortStateState(nextSort);
    setCurrentPageState(1);
    syncRoute({ page: 1, sortState: nextSort });
  };

  const pagination = {
    current: currentPage,
    pageSize,
    total: serverPaging ? total || 0 : sortedRows.length,
    onChange: (page: number, size: number) => {
      setCurrentPageState(page);
      setPageSizeState(size);
      syncRoute({ page, pageSize: size });
    },
    onShowSizeChange: (_: number, size: number) => {
      setCurrentPageState(1);
      setPageSizeState(size);
      syncRoute({ page: 1, pageSize: size });
    }
  };

  return {
    currentPage,
    pageSize,
    pagedRows,
    sortedRows,
    sortState,
    total: serverPaging ? total || 0 : sortedRows.length,
    pagination,
    setCurrentPage,
    setPageSize,
    setSortState,
    handleTableChange,
    renderIndex: (index: number) => (currentPage - 1) * pageSize + index + 1
  };
}
