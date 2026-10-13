export function groupRecentUpdates<T extends { kind: string }>(records: readonly T[], kindOrder: readonly string[]): { kind: string; records: T[] }[] {
    const groups = new Map<string, { kind: string; records: T[] }>();
    for (const record of records) {
        let group = groups.get(record.kind);
        if (!group) {
            group = { kind: record.kind, records: [] };
            groups.set(record.kind, group);
        }
        group.records.push(record);
    }
    const rank = (kind: string) => kindOrder.includes(kind) ? kindOrder.indexOf(kind) : kindOrder.length;
    return Array.from(groups.values()).sort((a, b) => rank(a.kind) - rank(b.kind));
}
