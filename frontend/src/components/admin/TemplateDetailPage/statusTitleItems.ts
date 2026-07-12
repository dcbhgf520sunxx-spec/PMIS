type StatusItem = {
  value: unknown;
};

function hasVisibleStatusValue(value: unknown) {
  if (value === null || value === undefined || typeof value === 'boolean') return false;
  if (typeof value !== 'string') return true;
  const text = value.trim();
  return text !== '' && text !== '-';
}

export function visibleStatusTitleItems<T extends StatusItem>(items: T[]) {
  return items.filter((item) => hasVisibleStatusValue(item.value));
}
