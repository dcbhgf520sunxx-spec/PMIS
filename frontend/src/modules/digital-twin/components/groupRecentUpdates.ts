export function groupRecentUpdates<T extends { kind: string }>(records: readonly T[]): { kind: string; records: T[] }[] {
    const groups = new Map<string, { kind: string; records: T[] }>();
    for (const record of records) {
        let group = groups.get(record.kind);
        if (!group) {
            group = { kind: record.kind, records: [] };
            groups.set(record.kind, group);
        }
        group.records.push(record);
    }
    return Array.from(groups.values());
}
