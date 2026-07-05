import { useEffect, useMemo, useState } from 'react';
import type { SearchTableProps } from '../SearchTable';

type SortOrder = 'ascend' | 'descend';

type SortState = {
  field?: string;
  order?: SortOrder;
};

type UseListPageDataOptions<T extends Record<string, unknown>> = {
  rows: T[];
  sorters?: Record<string, (a: T, b: T) => number>;
  defaultPageSize?: number;
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
  defaultPageSize = getStoredDefaultPageSize()
}: UseListPageDataOptions<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortState, setSortState] = useState<SortState>({});

  const sortedRows = useMemo(() => {
    if (!sortState.field || !sortState.order) return rows;

    const sorter = sorters[sortState.field];
    if (!sorter) return rows;

    return [...rows].sort((a, b) => {
      const result = sorter(a, b);
      return sortState.order === 'ascend' ? result : -result;
    });
  }, [rows, sortState, sorters]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [currentPage, pageSize, sortedRows.length]);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedRows]);

  const handleTableChange: NonNullable<SearchTableProps<T>['onChange']> = (_, __, sorter) => {
    setSortState(normalizeSorter(sorter));
    setCurrentPage(1);
  };

  return {
    currentPage,
    pageSize,
    pagedRows,
    sortedRows,
    sortState,
    total: sortedRows.length,
    setCurrentPage,
    setPageSize,
    setSortState,
    handleTableChange,
    renderIndex: (index: number) => (currentPage - 1) * pageSize + index + 1
  };
}
