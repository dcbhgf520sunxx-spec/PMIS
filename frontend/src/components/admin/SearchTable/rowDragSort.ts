import type { Key } from 'react';

export function moveTableRow<T>(
  rows: readonly T[],
  activeKey: Key,
  targetKey: Key,
  getKey: (row: T, index: number) => Key
) {
  if (activeKey === targetKey) return rows;

  const fromIndex = rows.findIndex((row, index) => getKey(row, index) === activeKey);
  const toIndex = rows.findIndex((row, index) => getKey(row, index) === targetKey);
  if (fromIndex < 0 || toIndex < 0) return rows;

  const nextRows = [...rows];
  const [movedRow] = nextRows.splice(fromIndex, 1);
  nextRows.splice(toIndex, 0, movedRow);
  return nextRows;
}
