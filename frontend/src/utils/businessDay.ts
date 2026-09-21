// The browser only detects when to refetch; overdue calculations stay on the server.
export function businessDay(now = Date.now()) {
  return new Date(now + 8 * 3600000).toISOString().slice(0, 10);
}
export function millisecondsUntilNextBusinessDay(now = Date.now()) {
  const shifted = now + 8 * 3600000;
  return 86400000 - ((shifted % 86400000) + 86400000) % 86400000;
}
