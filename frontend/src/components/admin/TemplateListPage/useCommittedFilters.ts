import { useCallback, useState } from 'react';

function cloneFilters<T extends Record<string, unknown>>(filters: T): T {
  return Object.fromEntries(
    Object.entries(filters).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value])
  ) as T;
}

export function useCommittedFilters<T extends Record<string, unknown>>(defaultFilters: T) {
  const [draftFilters, setDraftFilters] = useState<T>(() => cloneFilters(defaultFilters));
  const [appliedFilters, setAppliedFilters] = useState<T>(() => cloneFilters(defaultFilters));

  const commitFilters = useCallback(() => {
    setAppliedFilters(cloneFilters(draftFilters));
  }, [draftFilters]);

  const resetFilters = useCallback(() => {
    const nextFilters = cloneFilters(defaultFilters);
    setDraftFilters(nextFilters);
    setAppliedFilters(cloneFilters(defaultFilters));
  }, [defaultFilters]);

  return {
    draftFilters,
    appliedFilters,
    setDraftFilters,
    commitFilters,
    resetFilters
  };
}
