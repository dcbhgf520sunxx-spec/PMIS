export type RelativeLocation = { pathname: string; search?: string; hash?: string };

export function currentRelativePath(location: RelativeLocation) {
  return `${location.pathname}${location.search || ''}${location.hash || ''}`;
}

export function sanitizeInternalReturnTo(value: string | null | undefined, allowedRouteBase = '/') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  if (/^[\s\S]*[\u0000-\u001f]/.test(value)) return null;
  try {
    const parsed = new URL(value, 'http://local');
    if (parsed.origin !== 'http://local') return null;
    const base = allowedRouteBase.replace(/\/+$/, '') || '/';
    const inScope = base === '/'
      || parsed.pathname === base
      || parsed.pathname.startsWith(`${base}/`);
    return inScope ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null;
  } catch {
    return null;
  }
}

export function appendReturnTo(target: string, returnTo: string) {
  const parsed = new URL(target, 'http://local');
  parsed.searchParams.set('returnTo', returnTo);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function resolveReturnTo(search: string, fallback: string, allowedRouteBase = fallback) {
  const raw = new URLSearchParams(search).get('returnTo');
  return sanitizeInternalReturnTo(raw, allowedRouteBase) || fallback;
}
