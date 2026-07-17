import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { decodeListFilters, encodeListFilters, type ListRouteCodecs } from './listRouteState';

function cloneFilters<T extends Record<string, unknown>>(filters: T): T {
  return Object.fromEntries(
    Object.entries(filters).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value])
  ) as T;
}

type UseCommittedFiltersOptions<T extends Record<string, unknown>> = {
  urlSync?: boolean;
  codecs?: ListRouteCodecs<T>;
};

function sameFilters(left: Record<string, unknown>, right: Record<string, unknown>) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useCommittedFilters<T extends Record<string, unknown>>(
  defaultFilters: T,
  { urlSync = false, codecs = {} }: UseCommittedFiltersOptions<T> = {}
) {
  const location = useLocation();
  const navigate = useNavigate();
  const defaultsRef = useRef(defaultFilters);
  const codecsRef = useRef(codecs);
  const readFilters = useCallback(() => urlSync
    ? decodeListFilters(location.search, defaultsRef.current, codecsRef.current)
    : cloneFilters(defaultsRef.current), [location.search, urlSync]);
  const [draftFilters, setDraftFilters] = useState<T>(readFilters);
  const [appliedFilters, setAppliedFilters] = useState<T>(readFilters);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!urlSync) return;
    const next = readFilters();
    setDraftFilters((current) => sameFilters(current, next) ? current : cloneFilters(next));
    setAppliedFilters((current) => sameFilters(current, next) ? current : cloneFilters(next));
  }, [readFilters, urlSync]);

  const syncUrl = useCallback((filters: T) => {
    if (!urlSync) return;
    const search = encodeListFilters(location.search, filters, defaultsRef.current, codecsRef.current);
    if (search !== location.search) navigate(`${location.pathname}${search}${location.hash}`);
  }, [location.hash, location.pathname, location.search, navigate, urlSync]);

  const commitFilters = useCallback(() => {
    setAppliedFilters(cloneFilters(draftFilters));
    setRevision((value) => value + 1);
    syncUrl(draftFilters);
  }, [draftFilters, syncUrl]);

  const resetFilters = useCallback(() => {
    const nextFilters = cloneFilters(defaultsRef.current);
    setDraftFilters(nextFilters);
    setAppliedFilters(cloneFilters(nextFilters));
    setRevision((value) => value + 1);
    syncUrl(nextFilters);
  }, [syncUrl]);

  return {
    draftFilters,
    appliedFilters,
    revision,
    setDraftFilters,
    commitFilters,
    resetFilters
  };
}
