const RELOAD_AT_KEY = 'pmis:chunk-load-reload-at';
const RELOAD_GUARD_MS = 60_000;

type PreloadErrorEvent = Event & { payload?: unknown };

interface ChunkLoadRecoveryTarget {
  addEventListener: (name: string, listener: (event: PreloadErrorEvent) => void) => void;
  sessionStorage: Pick<Storage, 'getItem' | 'setItem'>;
  location: Pick<Location, 'reload'>;
}

export function installChunkLoadRecovery(
  target: ChunkLoadRecoveryTarget = window,
  now: () => number = Date.now
) {
  target.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();

    const current = now();
    const storedReloadAt = target.sessionStorage.getItem(RELOAD_AT_KEY);
    const lastReloadAt = storedReloadAt === null ? Number.NaN : Number(storedReloadAt);
    if (Number.isFinite(lastReloadAt) && current - lastReloadAt < RELOAD_GUARD_MS) {
      return;
    }

    target.sessionStorage.setItem(RELOAD_AT_KEY, String(current));
    target.location.reload();
  });
}
