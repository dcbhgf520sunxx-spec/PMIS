import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReloadOutlined } from '@ant-design/icons';
import { getTwinAiSummary, getPersonalTwinAiSummary } from '../../../api/digitalTwinApi';
import { AdminAsyncTaskStatus, AdminIconAction } from '../../../components/admin';
import type { TwinRecord } from '../types';
import { personalProductBrief } from './personalSummaryGroups';

export function TwinAiSummary({ productId, userId, updates, onSync, personal = false, personId, sourceRevision, range }: { productId: string; userId: string | number | undefined; updates: TwinRecord[]; onSync: () => Promise<unknown>; personal?: boolean; personId?: string; sourceRevision?: string; range?: {startDate:string;endDate:string} }) {
    const forceNext = useRef(false);
    const revision = sourceRevision ?? JSON.stringify(updates.map(r => [r.kind, r.id, r.name, r.status, r.updatedAt, r.dueDate, r.needsAttention]));
    const query = useQuery({
        queryKey: ['digital-twin', 'ai-summary', personal ? 'personal' : 'displayed-updates', userId, productId, personId, range?.startDate, range?.endDate, revision],
        queryFn: async ({ signal }) => {
            const force = forceNext.current;
            forceNext.current = false;
            const result = personal ? await getPersonalTwinAiSummary(signal, force, personId, range) : await getTwinAiSummary(productId, signal, force);
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
    const products = personal && query.data?.sections ? personalProductBrief(query.data.sections) : [];
    return <section className="rb-ai-summary" aria-label={personal ? "个人工作简报正文" : "AI更新总结"} aria-live="polite">
        <div className="rb-ai-heading"><strong>{personal ? '本期工作简报' : 'AI总结'}</strong><AdminIconAction label="重新生成" icon={<ReloadOutlined />} loading={query.isFetching} disabled={query.isFetching} onClick={regenerate}/></div>
        {query.isPending || query.isFetching ? <AdminAsyncTaskStatus state="running" title="正在生成总结"/> : query.isError ?
            <AdminAsyncTaskStatus state="error" title="总结暂不可用" errorMessage={query.error.message === 'Network Error' ? '网络连接失败，请稍后重试' : query.error.message} onRetry={regenerate}/>
            : <>{personal && query.data.sections ? <div className="rb-person-summary-products">{products.map(product=><section className="rb-summary-product" key={product.key} aria-label={product.name}>
                <h3 className="rb-summary-product-name">{product.name}</h3>
                <div className="rb-product-summary-columns">{[{key:'progress',title:'本期进展',items:product.progress},{key:'attention',title:'下阶段需关注',items:product.attention}].map(phase=><section className="rb-person-summary-section" key={phase.key} aria-label={`${product.name} · ${phase.title}`}>
                    <h4 className="rb-summary-section-title">{phase.title}</h4>
                    {phase.items.length?<dl className="rb-summary-topics">{phase.items.map(topic=><div className="rb-summary-topic-row" key={topic.key}>
                        <dt className="rb-summary-topic">{topic.name}</dt><dd>{topic.texts.join(' ')}</dd>
                    </div>)}</dl>:<p className="rb-context">{phase.key==='progress'?'暂无已确认进展':'暂无需特别关注的事项'}</p>}
                </section>)}</div>
            </section>)}{!products.length?<p className="rb-context">本期暂无可提炼的工作记录。</p>:null}</div> : <p className="rb-ai-text">{query.data.text}</p>}<div className="rb-ai-source" title={`模型：${query.data.model}；生成时间：${query.data.generatedAt}${personal ? `；覆盖本期 ${query.data.coveredCount ?? 0} 项授权工作；依据所选人员的单据描述、本期跟进与工作记录` : ''}`}>{query.data.provider} · 数据截至 {query.data.sourceAsOf.slice(5, 16)}{!personal ? <><br/>基于下方 {query.data.updatedCount} 条更新</> : null}</div></>}
    </section>;
}
