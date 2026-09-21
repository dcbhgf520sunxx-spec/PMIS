import { useSyncExternalStore } from 'react';
import { businessDay, millisecondsUntilNextBusinessDay } from '../utils/businessDay';

let day = businessDay();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
function check() {
  const next = businessDay();
  if (next !== day) {
    day = next;
    listeners.forEach(listener => listener());
  }
  clearTimeout(timer);
  if (listeners.size) timer = setTimeout(check, millisecondsUntilNextBusinessDay() + 50);
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    check();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    }
  };
}
export function useBusinessDay() {
  return useSyncExternalStore(subscribe, () => day, () => day);
}
