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
