import type { PersonalTwinRecord } from '../types';

export function personalDetailKind(requested: string | null, groups: { kind: string; available: boolean }[]) {
    const available = groups.filter(group => group.available);
    return available.find(group => group.kind === requested)?.kind
        || available.find(group => group.kind === 'requirements')?.kind
        || available[0]?.kind || 'requirements';
}

export function personalDetailCreatedDate(row: PersonalTwinRecord) {
    const value = new Date(row.createdAt);
    return Number.isNaN(value.getTime()) ? '—' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

export function personalRecordParent(row: PersonalTwinRecord) {
    const parent = row.chain.filter(link => !(link.kind === row.kind && link.id === row.id))
        .filter(link => ['products', 'requirements', 'projects'].includes(link.kind)).at(-1);
    if (parent) return { kind: parent.kind as 'products' | 'requirements' | 'projects', name: parent.name, id: parent.id };
    if (row.kind === 'tasks' && row.parentName === '日常任务') return { kind: 'daily' as const, name: '', id: '' };
    if (row.productId && row.productName && row.productName !== '—') return { kind: 'products' as const, name: row.productName, id: row.productId };
    return { kind: '' as const, name: '未关联／未授权', id: '' };
}

function productGroup(row: PersonalTwinRecord) {
    const product = row.chain.find(link => link.kind === 'products');
    const id = row.productId || product?.id || '';
    const name = row.productName && row.productName !== '—' ? row.productName : product?.name || '';
    return { kind: id && name ? 'products' : '', id, name };
}

function compareGroup(a: { kind: string; id: string; name: string }, b: { kind: string; id: string; name: string }) {
    return Number(!a.kind) - Number(!b.kind)
        || (a.name || '日常任务').localeCompare(b.name || '日常任务','zh-CN',{numeric:true})
        || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id,undefined,{numeric:true});
}

export function sortPersonalPeriodDetails(records: PersonalTwinRecord[], focus: string) {
    return [...records].sort((a,b) => {
        if (a.kind === 'planItems' && b.kind === 'planItems') return 0;
        const group = a.kind === b.kind
            ? a.kind === 'tasks' || a.kind === 'bugs'
                ? compareGroup(personalRecordParent(a),personalRecordParent(b))
                : a.kind === 'orders' ? compareGroup(productGroup(a),productGroup(b)) : 0
            : 0;
        if (group) return group;
        const time = focus === 'completed'
            ? (b.completionDate || '').localeCompare(a.completionDate || '')
            : a.kind === 'bugs' && b.kind === 'bugs'
                ? b.createdAt.localeCompare(a.createdAt)
                : (b.dueDate || '').localeCompare(a.dueDate || '');
        return time || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id,undefined,{numeric:true});
    });
}
