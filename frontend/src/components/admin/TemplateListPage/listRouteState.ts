import dayjs from 'dayjs';

export type ListRouteCodec<T> = {
  parse: (raw: string) => T | undefined;
  format: (value: T) => string | undefined;
};

export type ListRouteCodecs<T extends Record<string, unknown>> = Partial<Record<keyof T, ListRouteCodec<any>>>;

const stringCodec: ListRouteCodec<string> = {
  parse: (raw) => raw,
  format: (value) => value || undefined
};

export const listRouteCodecs = {
  string: stringCodec,
  number: {
    parse: (raw: string) => {
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
    },
    format: (value: number | undefined) => value === undefined || value === null ? undefined : String(value)
  } satisfies ListRouteCodec<number | undefined>,
  boolean: {
    parse: (raw: string) => raw === '1' ? true : raw === '0' ? false : undefined,
    format: (value: boolean | undefined) => value === undefined || value === null ? undefined : value ? '1' : '0'
  } satisfies ListRouteCodec<boolean | undefined>,
  stringArray: {
    parse: (raw: string) => raw ? raw.split(',').filter(Boolean) : [],
    format: (value: string[]) => value.length ? value.join(',') : undefined
  } satisfies ListRouteCodec<string[]>,
  dateArray: {
    parse: (raw: string) => raw ? raw.split(',').filter(Boolean).map((value) => dayjs(value)) : [],
    format: (value: unknown[]) => {
      const values = value.map((item) => {
        if (item && typeof item === 'object' && 'format' in item && typeof item.format === 'function') {
          return item.format('YYYY-MM-DD');
        }
        return String(item || '').slice(0, 10);
      }).filter(Boolean);
      return values.length ? values.join(',') : undefined;
    }
  } satisfies ListRouteCodec<unknown[]>
};

function inferredCodec(value: unknown): ListRouteCodec<unknown> {
  if (typeof value === 'number') return listRouteCodecs.number as ListRouteCodec<unknown>;
  if (typeof value === 'boolean') return listRouteCodecs.boolean as ListRouteCodec<unknown>;
  if (Array.isArray(value)) return listRouteCodecs.stringArray as ListRouteCodec<unknown>;
  return stringCodec as ListRouteCodec<unknown>;
}

function sameValue(left: unknown, right: unknown) {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }
  return left === right;
}

function toSearch(params: URLSearchParams) {
  const value = params.toString();
  return value ? `?${value}` : '';
}

export function decodeListFilters<T extends Record<string, unknown>>(
  search: string,
  defaults: T,
  codecs: ListRouteCodecs<T> = {}
): T {
  const params = new URLSearchParams(search);
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as Array<keyof T>) {
    const raw = params.get(`q_${String(key)}`);
    if (raw === null) continue;
    const codec = (codecs[key] || inferredCodec(defaults[key])) as ListRouteCodec<T[typeof key]>;
    const parsed = codec.parse(raw);
    if (parsed !== undefined) result[key] = parsed;
  }
  return result;
}

export function encodeListFilters<T extends Record<string, unknown>>(
  search: string,
  filters: T,
  defaults: T,
  codecs: ListRouteCodecs<T> = {}
) {
  const params = new URLSearchParams(search);
  for (const key of Object.keys(defaults) as Array<keyof T>) {
    const param = `q_${String(key)}`;
    const value = filters[key];
    if (sameValue(value, defaults[key])) {
      params.delete(param);
      continue;
    }
    const codec = (codecs[key] || inferredCodec(defaults[key])) as ListRouteCodec<T[typeof key]>;
    const formatted = codec.format(value);
    if (formatted === undefined || formatted === '') params.delete(param);
    else params.set(param, formatted);
  }
  params.delete('page');
  return toSearch(params);
}

export type ListRouteState = {
  page: number;
  pageSize: number;
  sortField?: string;
  sortOrder?: 'ascend' | 'descend';
  view?: string;
};

type ListRouteDefaults = { pageSize: number; view?: string };

function positiveInteger(raw: string | null, fallback: number) {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function decodeListRouteState(search: string, defaults: ListRouteDefaults, allowedViews: string[] = []): ListRouteState {
  const params = new URLSearchParams(search);
  const sortOrder = params.get('order');
  const rawView = params.get('view') || defaults.view;
  return {
    page: positiveInteger(params.get('page'), 1),
    pageSize: positiveInteger(params.get('pageSize'), defaults.pageSize),
    sortField: params.get('sort') || undefined,
    sortOrder: sortOrder === 'ascend' || sortOrder === 'descend' ? sortOrder : undefined,
    view: rawView && (!allowedViews.length || allowedViews.includes(rawView)) ? rawView : defaults.view
  };
}

export function encodeListRouteState(search: string, state: Partial<ListRouteState>, defaults: ListRouteDefaults) {
  const params = new URLSearchParams(search);
  const setOrDelete = (key: string, value?: string) => value ? params.set(key, value) : params.delete(key);
  setOrDelete('page', state.page && state.page > 1 ? String(state.page) : undefined);
  setOrDelete('pageSize', state.pageSize && state.pageSize !== defaults.pageSize ? String(state.pageSize) : undefined);
  setOrDelete('sort', state.sortField && state.sortOrder ? state.sortField : undefined);
  setOrDelete('order', state.sortField && state.sortOrder ? state.sortOrder : undefined);
  setOrDelete('view', state.view && state.view !== defaults.view ? state.view : undefined);
  return toSearch(params);
}
