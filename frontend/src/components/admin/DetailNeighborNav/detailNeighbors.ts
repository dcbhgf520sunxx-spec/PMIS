export type DetailNeighborParams = Record<string, string | number | boolean | null | undefined>;

export type DetailNeighborContext = {
  moduleKey: string;
  routeBase: string;
  params: DetailNeighborParams;
  savedAt: number;
};

const contextPrefix = 'pmis:detail-neighbor:';

function storageKey(moduleKey: string) {
  return `${contextPrefix}${moduleKey}`;
}

function normalizeRouteBase(routeBase: string) {
  return routeBase.replace(/\/+$/, '') || '/';
}

export function buildDetailNeighborPath(routeBase: string, id: string | number) {
  return `${normalizeRouteBase(routeBase)}/${id}`;
}

export function createDetailNeighborContext({
  moduleKey,
  routeBase,
  params
}: Omit<DetailNeighborContext, 'savedAt'>): DetailNeighborContext {
  return {
    moduleKey,
    routeBase: normalizeRouteBase(routeBase),
    params,
    savedAt: Date.now()
  };
}

export function saveDetailNeighborContext(context: DetailNeighborContext) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(storageKey(context.moduleKey), JSON.stringify(context));
}

export function loadDetailNeighborContext(moduleKey: string): DetailNeighborContext | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(storageKey(moduleKey));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as DetailNeighborContext;
    if (!parsed || parsed.moduleKey !== moduleKey || !parsed.routeBase || typeof parsed.params !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
