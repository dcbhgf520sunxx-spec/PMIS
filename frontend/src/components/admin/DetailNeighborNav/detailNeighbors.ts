export type DetailNeighborParams = Record<string, string | number | boolean | null | undefined>;

export type DetailNeighborContext = {
  moduleKey: string;
  routeBase: string;
  params: DetailNeighborParams;
  sourcePath?: string;
  savedAt: number;
};

const contextPrefix = 'pmis:detail-neighbor:';
const contextTtlMs = 30 * 60 * 1000;

function storageKey(moduleKey: string) {
  return `${contextPrefix}${moduleKey}`;
}

function normalizeRouteBase(routeBase: string) {
  return routeBase.replace(/\/+$/, '') || '/';
}

export function buildDetailNeighborPath(routeBase: string, id: string | number, search = '') {
  return `${normalizeRouteBase(routeBase)}/${id}${search}`;
}

export function isDetailNeighborContextFresh(context: DetailNeighborContext, now = Date.now()) {
  return Number.isFinite(context.savedAt) && now - context.savedAt <= contextTtlMs;
}

export function createDetailNeighborContext({
  moduleKey,
  routeBase,
  params,
  sourcePath
}: Omit<DetailNeighborContext, 'savedAt'>): DetailNeighborContext {
  return {
    moduleKey,
    routeBase: normalizeRouteBase(routeBase),
    params,
    sourcePath,
    savedAt: Date.now()
  };
}

export function saveDetailNeighborContext(context: DetailNeighborContext) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(storageKey(context.moduleKey), JSON.stringify(context));
}

export function loadDetailNeighborContext(moduleKey: string, expectedSourcePath?: string | null): DetailNeighborContext | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(storageKey(moduleKey));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as DetailNeighborContext;
    if (!parsed || parsed.moduleKey !== moduleKey || !parsed.routeBase || typeof parsed.params !== 'object'
      || !isDetailNeighborContextFresh(parsed)
      || (expectedSourcePath !== undefined && parsed.sourcePath !== expectedSourcePath)) {
      window.sessionStorage.removeItem(storageKey(moduleKey));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
