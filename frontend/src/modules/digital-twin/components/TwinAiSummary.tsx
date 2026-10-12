import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReloadOutlined } from '@ant-design/icons';
import { getTwinAiSummary } from '../../../api/digitalTwinApi';
import { AdminAsyncTaskStatus, AdminIconAction } from '../../../components/admin';
import type { TwinRecord } from '../types';

export function TwinAiSummary({ productId, userId, updates, onSync }: { productId: string; userId: string | number | undefined; updates: TwinRecord[]; onSync: () => Promise<unknown> }) {
    const forceNext = useRef(false);
    const revision = JSON.stringify(updates.map(r => [r.kind, r.id, r.name, r.status, r.updatedAt, r.dueDate, r.needsAttention]));
    const query = useQuery({
        queryKey: ['digital-twin', 'ai-summary', 'displayed-updates', userId, productId, revision],
        queryFn: async ({ signal }) => {
            const force = forceNext.current;
            forceNext.current = false;
            const result = await getTwinAiSummary(productId, signal, force);
            if (result.sourceRevision !== revision) {
                await onSync();
                throw new Error('更新记录已变化，正在同步总结，请稍后重试');
            }
            return result;
        },
        staleTime: 10 * 60000, refetchInterval: 5 * 60000, retry: false, refetchOnWindowFocus: false
    });
    const regenerate = () => {
        if (query.isFetching) return;
        forceNext.current = true;
        void query.refetch();
    };
    return <section className="rb-ai-summary" aria-label="AI更新总结" aria-live="polite">
        <div className="rb-ai-heading"><strong>AI总结</strong><AdminIconAction label="重新生成" icon={<ReloadOutlined />} loading={query.isFetching} disabled={query.isFetching} onClick={regenerate}/></div>
        {query.isPending || query.isFetching ? <AdminAsyncTaskStatus state="running" title="正在生成总结"/> : query.isError ?
            <AdminAsyncTaskStatus state="error" title="总结暂不可用" errorMessage={query.error.message === 'Network Error' ? '网络连接失败，请稍后重试' : query.error.message} onRetry={regenerate}/>
            : <><p className="rb-ai-text">{query.data.text}</p><div className="rb-ai-source" title={`生成时间：${query.data.generatedAt}`}>DeepSeek · 数据截至 {query.data.sourceAsOf.slice(5, 16)}<br/>基于下方 {query.data.updatedCount} 条更新</div></>}
    </section>;
}
