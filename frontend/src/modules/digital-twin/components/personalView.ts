import type { PersonalTwinRecord } from '../types';

export const personalKinds = ['requirements', 'projects', 'planItems', 'tasks', 'bugs', 'orders'];
export function personalView(params: URLSearchParams) {
    const kind = personalKinds.includes(params.get('kind') || '') ? params.get('kind')! : 'all';
    const role = ['responsible', 'participating', 'all'].includes(params.get('role') || '') ? params.get('role')! : 'responsible';
    const focus = ['recent', 'current', 'next', 'priority', 'attention', 'overdue', 'dueSoon'].includes(params.get('focus') || '') ? params.get('focus')! : 'all';
    return { kind, role, focus };
}
export function personalViewRecords(records: PersonalTwinRecord[], { kind, role, focus }: { kind: string; role: string; focus: string }, events: { kind: string; recordId: string }[] = []) {
    return records.filter(row => {
        if (kind !== 'all' && row.kind !== kind) return false;
        if (role === 'responsible' && row.relationship !== 'responsible') return false;
        if (role === 'participating' && row.relationship === 'responsible') return false;
        if (focus === 'all') return true;
        if (focus === 'recent') return events.some(event => event.kind === row.kind && event.recordId === row.id);
        if (row.relationship !== 'responsible' || !row.isOpen) return false;
        switch (focus) {
            case 'current': return row.workState === 'active';
            case 'next': return row.workState !== 'active' || row.isOverdue || row.needsAttention || row.dueSoon;
            case 'priority': return row.isOverdue || row.dueSoon || row.needsAttention;
            case 'overdue': return row.isOverdue;
            case 'dueSoon': return row.dueSoon;
            case 'attention': return row.needsAttention;
            default: return false;
        }
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id, undefined, { numeric: true }) || a.kind.localeCompare(b.kind));
}

export function filterPersonalPeriodRecords(records: PersonalTwinRecord[], view: {kind:string; role:string; focus:string; attention:string; search:string}, excluded: PersonalTwinRecord[] = []) {
    return (view.focus==='excluded' ? excluded : records).filter(row=>{
        if(view.kind!=='all'&&row.kind!==view.kind)return false;
        if(view.role==='responsible'&&row.relationship!=='responsible')return false;
        if(view.role==='participating'&&row.relationship!=='participant')return false;
        if(view.role==='collaborating'&&row.relationship!=='collaborator')return false;
        if(view.focus!=='excluded'&&row.included===false)return false;
        if(view.focus==='completed'&&row.statisticStatus!=='completed')return false;
        if(view.focus==='unfinished'&&row.statisticStatus!=='unfinished')return false;
        if(view.focus==='unknown'&&row.statisticStatus!=='unknown')return false;
        if(view.attention==='overdue'&&!row.isOverdue)return false;
        if(view.attention==='high'&&!row.needsAttention)return false;
        if(view.attention==='due'&&!row.dueSoon)return false;
        return !view.search||`${row.name} ${row.code} ${row.parentName} ${row.productName}`.toLowerCase().includes(view.search.trim().toLowerCase());
    });
}
