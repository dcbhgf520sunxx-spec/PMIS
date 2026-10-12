type RelationEndpoint = { id: string; source: string; target: string };

export const relationKey = (link: RelationEndpoint) => `${link.id}:${link.source}:${link.target}`;

export function expandedRelationKeys(params: URLSearchParams, links: RelationEndpoint[]): string[] {
  const available = links.map(relationKey);
  if (params.has('open')) return [...new Set(params.getAll('open'))].filter(key => available.includes(key));
  // Preserve links saved before endpoint-specific expansion was introduced.
  const legacy = params.get('relation');
  return links.filter(link => link.id === legacy || relationKey(link) === legacy).map(relationKey);
}

export function focusAfterExpansion(previous: string[], next: string[], current: string): string {
  return next.filter(key => !previous.includes(key)).at(-1) || (next.includes(current) ? current : '');
}
