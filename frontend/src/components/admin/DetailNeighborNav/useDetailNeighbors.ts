import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  buildDetailNeighborPath,
  loadDetailNeighborContext,
  type DetailNeighborParams
} from './detailNeighbors';

export type DetailNeighborsResult = {
  prevId: string | number | null;
  nextId: string | number | null;
  ordinal?: number;
  total?: number;
};

type UseDetailNeighborsParams = {
  id?: string;
  moduleKey: string;
  routeBase: string;
  fetchNeighbors: (id: string, params: DetailNeighborParams) => Promise<DetailNeighborsResult>;
};

export function useDetailNeighbors({
  id,
  moduleKey,
  routeBase,
  fetchNeighbors
}: UseDetailNeighborsParams) {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = new URLSearchParams(location.search).get('returnTo');
  const [neighbors, setNeighbors] = useState<DetailNeighborsResult>({
    prevId: null,
    nextId: null
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    const context = returnTo ? loadDetailNeighborContext(moduleKey, returnTo) : null;
    const params = context?.params || {};

    setLoading(true);
    fetchNeighbors(id, params)
      .then((result) => {
        if (!cancelled) setNeighbors(result);
      })
      .catch(() => {
        if (!cancelled) setNeighbors({ prevId: null, nextId: null });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchNeighbors, id, moduleKey, returnTo]);

  const context = returnTo ? loadDetailNeighborContext(moduleKey, returnTo) : null;
  const activeRouteBase = context?.routeBase || routeBase;

  return {
    ...neighbors,
    loading,
    navigateNeighbor: (targetId: string | number) => {
      navigate(buildDetailNeighborPath(activeRouteBase, targetId, location.search), { replace: true });
    }
  };
}
