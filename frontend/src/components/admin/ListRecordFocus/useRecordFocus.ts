import { useEffect, useRef, useState } from 'react';
import { App } from 'antd';
import { useLocation } from 'react-router-dom';
import { currentRelativePath } from '../PageNavigation/pageNavigation';
import { recordFocusSources, saveRecordFocus, takeRecordFocus } from './recordFocus';
import { useRecordHighlight } from './useRecordHighlight';

export type RunRecordChange = <R>(ids: readonly string[], write: () => Promise<R>, onSaved?: (result: R) => void | Promise<void>) => Promise<R | undefined>;
type RecordPosition = { id?: string | null; page?: number; ordinal?: number; total?: number };
type ListFocusOptions<T> = {
  list: { pagedRows: T[]; currentPage: number; pageSize: number; loading?: boolean; error?: string; setCurrentPage: (page: number) => void };
  reload: () => Promise<unknown>;
  params: Record<string, unknown>;
  resolvePosition: (ids: string[], params: Record<string, unknown>) => Promise<RecordPosition>;
  reveal?: (row: T) => void;
};

function useChangeGuard(context: string) {
  const guard = useRef({ mounted: true, context, request: 0 });
  if (guard.current.context !== context) { guard.current.context = context; guard.current.request++; }
  useEffect(() => {
    const state = guard.current;
    state.mounted = true;
    return () => { state.mounted = false; state.request++; };
  }, []);
  return () => {
    const request = ++guard.current.request;
    return () => guard.current.mounted && guard.current.context === context && guard.current.request === request;
  };
}

export function useListRecordFocus<T extends { id: string }>({ list, reload, params, resolvePosition, reveal }: ListFocusOptions<T>) {
  const { message } = App.useApp();
  const location = useLocation();
  const context = JSON.stringify([location.pathname, params, list.pageSize]);
  const begin = useChangeGuard(context);
  const { highlight, tableProps } = useRecordHighlight({ rows: list.pagedRows, loading: list.loading, error: list.error });
  const [pending, setPending] = useState<{ ids: string[]; id: string; page: number; active: () => boolean }>();
  const latest = useRef({ reload, params, resolvePosition });
  latest.current = { reload, params, resolvePosition };
  useEffect(() => { setPending(undefined); highlight([]); }, [context, highlight]);
  const locate = async (ids: string[], active: () => boolean) => {
    setPending(undefined);
    highlight([]);
    try {
      await latest.current.reload();
      if (!active()) return;
      const position = await latest.current.resolvePosition(ids, { ...latest.current.params, pageSize: list.pageSize });
      if (!active()) return;
      if (!position.id || !position.page) {
        message.info('状态已更新，已不符合当前筛选条件');
        return;
      }
      list.setCurrentPage(position.page);
      setPending({ ids, id: position.id, page: position.page, active });
    } catch {
      if (active()) message.warning('状态已更新，列表定位失败，请刷新后查询');
    }
  };
  useEffect(() => {
    if (!pending) return;
    if (!pending.active()) { setPending(undefined); return; }
    if (list.loading || list.currentPage !== pending.page) return;
    const row = list.pagedRows.find(item => item.id === pending.id);
    if (row && !list.error) {
      reveal?.(row);
      highlight(pending.ids, pending.id);
    } else {
      message.warning('状态已更新，列表已发生变化，请刷新后查询');
    }
    setPending(undefined);
  }, [pending, list.loading, list.error, list.currentPage, list.pagedRows, highlight, reveal, message]);
  const initialSource = useRef(currentRelativePath(location));
  useEffect(() => {
    const ids = takeRecordFocus(initialSource.current);
    if (ids.length) void locate(ids, begin());
    // Return intent is consumed once when this source list mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const run: RunRecordChange = async (ids, write, onSaved) => {
    const active = begin();
    const result = await write();
    if (!active()) return undefined;
    try { await onSaved?.(result); }
    catch { if (active()) message.warning('状态已更新，页面刷新失败，请刷新后查询'); }
    if (!active()) return undefined;
    await locate([...ids], active);
    return active() ? result : undefined;
  };
  return { run, tableProps };
}

export function useDetailRecordFocus({ listPath, returnTarget }: { listPath: string; returnTarget: string }) {
  const { message } = App.useApp();
  const location = useLocation();
  const begin = useChangeGuard(currentRelativePath(location));
  const run: RunRecordChange = async (ids, write, onSaved) => {
    const active = begin();
    const result = await write();
    if (!active()) return undefined;
    for (const source of recordFocusSources(listPath, returnTarget)) saveRecordFocus(source, ids);
    try { await onSaved?.(result); }
    catch { if (active()) message.warning('状态已更新，页面刷新失败，请刷新后查询'); }
    return active() ? result : undefined;
  };
  return { run };
}

export function useLocalRecordFocus<T>(options: Parameters<typeof useRecordHighlight<T>>[0]) {
  const location = useLocation();
  const source = currentRelativePath(location);
  const begin = useChangeGuard(source);
  const { message } = App.useApp();
  const { highlight, tableProps } = useRecordHighlight(options);
  useEffect(() => {
    highlight([]);
    const ids = takeRecordFocus(source);
    if (ids.length) highlight(ids);
  }, [source, highlight]);
  const run: RunRecordChange = async (ids, write, onSaved) => {
    const active = begin();
    const result = await write();
    if (!active()) return undefined;
    try { await onSaved?.(result); }
    catch { if (active()) message.warning('状态已更新，页面刷新失败，请刷新后查询'); }
    if (!active()) return undefined;
    highlight(ids);
    return result;
  };
  return { highlight, tableProps, run };
}
