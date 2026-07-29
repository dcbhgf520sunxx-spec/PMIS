const runtimeEnv = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env;

export const NEXUS_AGENT_BASE_URL = runtimeEnv?.VITE_NEXUS_AGENT_BASE_URL?.trim()
  || 'http://183.129.242.90:3100';
export const NEXUS_AGENT_ID = runtimeEnv?.VITE_NEXUS_AGENT_ID?.trim()
  || 'bbadcfd5-424f-369d-96e2-0c0a6a65073a';

export function getNexusChatUrl(ticket: string) {
  const url = new URL(`/embed/${encodeURIComponent(NEXUS_AGENT_ID)}`, NEXUS_AGENT_BASE_URL);
  url.searchParams.set('ticket', ticket);
  return url.toString();
}
