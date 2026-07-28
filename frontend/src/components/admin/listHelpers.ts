export type ListFilterItemLike = {
  hidden?: boolean;
  [key: string]: unknown;
};

type SortValue = string | number | boolean | null | undefined;
type SortGetter<T> = (row: T) => SortValue;
type ListSorter<T> = (a: T, b: T) => number;

function normalizeText(value: SortValue) {
  return value === null || value === undefined ? '' : String(value);
}

function normalizeNumber(value: SortValue) {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeDate(value: SortValue) {
  if (!value) return 0;
  const timestamp = new Date(String(value)).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function visibleListFilterItems<T extends ListFilterItemLike>(items: T[]) {
  return items.filter((item) => !item.hidden);
}

export function createListFilterItems<T extends ListFilterItemLike>(items: T[]) {
  return visibleListFilterItems(items);
}

export function resolveListViewFilter<T>(view: string, value: T, filterView = 'all') {
  return {
    filterValue: value,
    scopeValue: view === filterView ? value : undefined
  };
}

export const listSorters = {
  text: <T>(getter: SortGetter<T>): ListSorter<T> => (
    (a, b) => normalizeText(getter(a)).localeCompare(normalizeText(getter(b)))
  ),
  number: <T>(getter: SortGetter<T>): ListSorter<T> => (
    (a, b) => normalizeNumber(getter(a)) - normalizeNumber(getter(b))
  ),
  date: <T>(getter: SortGetter<T>): ListSorter<T> => (
    (a, b) => normalizeDate(getter(a)) - normalizeDate(getter(b))
  ),
  custom: <T>(sorter: ListSorter<T>) => sorter
};

export function createListSorters<T>(sorters: Record<string, ListSorter<T>>) {
  return sorters;
}
