export function normalizeOptionalWorkOrderDateText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 10) : '';
}
