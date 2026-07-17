import type { ReactNode } from 'react';

export function normalizeDetailMetaValue(value: ReactNode): ReactNode {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string' && !value.trim()) return '-';
  return value;
}
