import type { TwinAiSummary } from '../types';

type SummaryItem = NonNullable<TwinAiSummary['sections']>['progress'][number];
export function personalSummaryGroups(items: readonly SummaryItem[]) {
    const groups = new Map<string, { key: string; name: string; topics: { key: string; name: string; texts: string[] }[] }>();
    for (const item of items) {
        const key = item.productId || item.productName || 'unassigned';
        if (!groups.has(key)) groups.set(key, { key, name: item.productName || '未关联／未授权产品', topics: [] });
        const group = groups.get(key)!;
        const topicKey = item.projectId || item.topic || 'other';
        let topic = group.topics.find(row => row.key === topicKey);
        if (!topic) { topic = { key: topicKey, name: item.topic || '其他工作', texts: [] }; group.topics.push(topic); }
        if (!topic.texts.includes(item.text)) topic.texts.push(item.text);
    }
    return [...groups.values()];
}

export function personalProductBrief(sections: NonNullable<TwinAiSummary['sections']>) {
    type Group = ReturnType<typeof personalSummaryGroups>[number];
    const products = new Map<string, { key: string; name: string; progress: Group['topics']; attention: Group['topics'] }>();
    for (const [phase, items] of [['progress', sections.progress], ['attention', [...sections.priorities, ...sections.concerns]]] as const) {
        for (const group of personalSummaryGroups(items)) {
            if (!products.has(group.key)) products.set(group.key, { key: group.key, name: group.name, progress: [], attention: [] });
            products.get(group.key)![phase] = group.topics;
        }
    }
    return [...products.values()];
}
