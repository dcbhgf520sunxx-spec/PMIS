import { sanitizeInternalReturnTo } from '../PageNavigation/pageNavigation';

type FocusStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type FocusIntent = { sourcePath: string; ids: string[]; savedAt: number };
const lifetime = 30 * 60 * 1000;
const keyFor = (path: string) => `pmis:record-focus:${new URL(path, 'http://local').pathname}`;

export function recordFocusSources(listPath: string, returnTarget: string) {
  const sources: string[] = [];
  let path = sanitizeInternalReturnTo(returnTarget, listPath);
  for (let depth = 0; path && depth < 8; depth++) {
    if (sources.includes(path)) break;
    sources.push(path);
    const parsed = new URL(path, 'http://local');
    if (parsed.pathname === listPath) break;
    path = sanitizeInternalReturnTo(parsed.searchParams.get('returnTo'), listPath);
  }
  return sources;
}

function readIntent(storage: FocusStorage, key: string, now: number): FocusIntent | undefined {
  try {
    const raw = storage.getItem(key);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as FocusIntent;
    if (!sanitizeInternalReturnTo(value.sourcePath) || !Array.isArray(value.ids)
      || !value.ids.every(id => typeof id === 'string' && /^\d+$/.test(id))
      || !Number.isFinite(value.savedAt) || now < value.savedAt || now - value.savedAt > lifetime) return undefined;
    return value;
  } catch { return undefined; }
}

export function saveRecordFocus(sourcePath: string, ids: readonly string[], storage: FocusStorage = sessionStorage, now = Date.now()) {
  const source = sanitizeInternalReturnTo(sourcePath);
  if (!source) return;
  const key = keyFor(source);
  try {
    const previous = readIntent(storage, key, now);
    const merged = new Set([...(previous?.sourcePath === source ? previous.ids : []), ...ids]);
    storage.setItem(key, JSON.stringify({ sourcePath: source, ids: [...merged], savedAt: now }));
  } catch { /* Storage can be unavailable in private browsing. */ }
}

export function takeRecordFocus(sourcePath: string, storage: FocusStorage = sessionStorage, now = Date.now()): string[] {
  const source = sanitizeInternalReturnTo(sourcePath);
  if (!source) return [];
  const key = keyFor(source);
  try {
    const intent = readIntent(storage, key, now);
    if (intent && intent.sourcePath !== source) return [];
    storage.removeItem(key);
    return intent?.sourcePath === source ? intent.ids : [];
  } catch { return []; }
}
