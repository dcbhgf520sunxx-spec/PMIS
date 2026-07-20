export type ListCellDataIndex = string | number | readonly (string | number)[];

export function readListCellValue(
  record: Record<string, unknown>,
  dataIndex: ListCellDataIndex
): unknown {
  const path = Array.isArray(dataIndex) ? dataIndex : [dataIndex];

  return path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string | number, unknown>)[key];
  }, record);
}

export function getListCellTitle(value: unknown): string | undefined {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return undefined;
  return value.trim() ? value : undefined;
}
