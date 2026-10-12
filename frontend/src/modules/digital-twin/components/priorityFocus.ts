import type { TwinFocus, TwinNode, TwinRecord } from '../types';

export function normalizeFocus(kind: string, requested: string | null): TwinFocus | '' {
    if (requested === 'attention' && kind === 'bugs') return 'attention';
    if (requested === 'critical' && kind === 'bugs') return 'critical';
    return requested === 'high' && ['requirements', 'projects', 'tasks', 'bugs', 'orders'].includes(kind) ? 'high' : '';
}

export function getFocusedRecords(records: TwinRecord[], kind: string, focus: TwinFocus | '') {
    return records.filter(record => record.kind === kind && (!focus || (record.needsAttention && (focus === 'attention' ? [3, 4].includes(record.priorityCode ?? 0) : record.priorityCode === (focus === 'critical' ? 4 : kind === 'bugs' ? 3 : 2)))));
}

export function focusLabel(kind: string, focus: TwinFocus | '') {
    if (focus === 'attention') return '高及致命缺陷';
    return focus === 'critical' ? '致命' : kind === 'bugs' ? '高严重程度' : kind === 'orders' ? '高紧急程度' : '高优先级';
}

export function mergeNodeAlerts(kind: string, alerts: TwinNode['priorityAlerts']) {
    if (!alerts.length) return null;
    const level = alerts.some(alert => alert.level === 'critical') ? 'critical' : 'high';
    const focus: TwinFocus = kind === 'bugs' ? 'attention' : 'high';
    const count = alerts.reduce((total, alert) => total + alert.count, 0);
    const text = `${kind === 'bugs' ? '高危' : kind === 'orders' ? '紧急' : '高优'} ${count}`;
    const description = alerts.map(alert => `${alert.label}未结束 ${alert.count} 项${alert.detail ? ' · ' + alert.detail : ''}`).join('；');
    return { level: level as 'high' | 'critical', focus, text, description };
}
