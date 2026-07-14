import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { decodeListRouteState, encodeListRouteState } from './listRouteState';

export function useListViewState<T extends string>(defaultView: T, allowedViews: readonly T[], urlSync = false) {
  const location = useLocation();
  const navigate = useNavigate();
  const readView = useCallback(() => urlSync
    ? (decodeListRouteState(location.search, { pageSize: 20, view: defaultView }, [...allowedViews]).view as T)
    : defaultView, [allowedViews, defaultView, location.search, urlSync]);
  const [view, setViewState] = useState<T>(readView);

  useEffect(() => {
    if (urlSync) setViewState(readView());
  }, [readView, urlSync]);

  const setView = useCallback((next: T) => {
    setViewState(next);
    if (!urlSync) return;
    const current = decodeListRouteState(location.search, { pageSize: 20, view: defaultView }, [...allowedViews]);
    const search = encodeListRouteState(location.search, { ...current, page: 1, view: next }, { pageSize: 20, view: defaultView });
    navigate(`${location.pathname}${search}${location.hash}`);
  }, [allowedViews, defaultView, location.hash, location.pathname, location.search, navigate, urlSync]);

  return [view, setView] as const;
}
