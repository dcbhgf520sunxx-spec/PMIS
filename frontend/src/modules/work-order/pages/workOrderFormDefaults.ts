import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

export function buildWorkOrderCreateInitialValues(
  currentUserId?: number,
  today: Dayjs = dayjs()
) {
  return {
    followerId: currentUserId === undefined ? undefined : String(currentUserId),
    submitTime: today
  };
}

export function parseOptionalWorkOrderDate(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized || normalized === '-') return undefined;

  const parsed = dayjs(normalized);
  return parsed.isValid() ? parsed : undefined;
}
