import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProColumns } from '@ant-design/pro-components';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getTwinProducts, getTwinSnapshot } from '../../../api/digitalTwinApi';
import { appendReturnTo, AdminButton, AdminEmptyState, AdminSelect, AdminTextAction, TemplateDetailPage, TemplateDetailSection, TemplateDetailTableSection } from '../../../components/admin';
import { useAuthStore } from '../../../stores/authStore';
import { TwinGraph } from '../components/TwinGraph';
import { renderTwinRecordStatus } from '../components/recordStatus';
import { focusLabel, getFocusedRecords, normalizeFocus } from '../components/priorityFocus';
import { priorityFieldLabel, renderTwinRecordPriority } from '../components/recordPriority';
import { groupRecentUpdates } from '../components/groupRecentUpdates';
import { kindNames, type TwinRecord, type TwinFocus } from '../types';
import './DigitalTwinPage.css';
const nodeGroups: Record<string, string> = { requirement: 'requirements', project: 'projects', work: 'tasks', quality: 'bugs', plan: 'plan', contract: 'finance', payment: 'finance', maintenance: 'maintenance', order: 'orders' };
export function DigitalTwinPage() {
    const navigate = useNavigate();
    const userId = useAuthStore(state => state.user?.id);
    const [searchParams, setSearchParams] = useSearchParams();
    const product = searchParams.get('product') || '';
    const setProduct = (id: string) => setSearchParams({ product: id }, { replace: true });
    const rootRef = useRef<HTMLDivElement>(null);
    const restoredSource = useRef('');
    const node = searchParams.get('node') || 'product';
    const requestedKind = searchParams.get('kind') || 'projects';
    const kind = kindNames[requestedKind] ? requestedKind : 'projects';
    const focus = normalizeFocus(kind, searchParams.get('focus'));
    const selection = searchParams.get('recordId') ? { id: searchParams.get('recordId')!, kind: searchParams.get('recordKind') || kind } : null;
    const requestedPage = Number(searchParams.get('page'));
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage - 1 : 0;
    const requestedSize = Number(searchParams.get('pageSize'));
    const pageSize = [6, 12, 24].includes(requestedSize) ? requestedSize : 6;
    const updateView = (patch: Record<string, string | null>) => setSearchParams(previous => {
        const next = new URLSearchParams(previous);
        next.delete('scroll');
        for (const [key, value] of Object.entries(patch)) {
            if (value === null) next.delete(key); else next.set(key, value);
        }
        return next;
    }, { replace: true });
    const productsQuery = useQuery({ queryKey: ['digital-twin', 'products', userId], queryFn: ({ signal }) => getTwinProducts(signal) });
    const products = productsQuery.data || [];
    const productId = products.some(row => row.id === product) ? product : products[0]?.id || '';
    const snapshotQuery = useQuery({ queryKey: ['digital-twin', 'snapshot', userId, productId], queryFn: ({ signal }) => getTwinSnapshot(productId, signal), enabled: Boolean(productId), refetchInterval: 60000 });
    const data = snapshotQuery.data;
    const selectedRecord = data?.records.find(row => row.id === selection?.id && row.kind === selection.kind);
    const group = data?.groups.find(row => row.key === nodeGroups[node]);
    const selectedNode = data?.nodes.find(row => row.key === node);
    const records = getFocusedRecords(data?.records || [], kind, focus);
    const resolvedPage = Math.min(page, Math.max(0, Math.ceil(records.length / pageSize) - 1));
    const error = productsQuery.error || snapshotQuery.error;
    const loading = productsQuery.isPending || (Boolean(productId) && snapshotQuery.isPending);
    useEffect(() => {
        if (!data || loading || restoredSource.current === searchParams.toString()) return;
        const scroll = Number(searchParams.get('scroll'));
        if (!Number.isFinite(scroll) || scroll <= 0) return;
        const frame = requestAnimationFrame(() => {
            rootRef.current?.querySelector('.admin-template-detail-page')?.scrollTo({ top: scroll });
            restoredSource.current = searchParams.toString();
        });
        return () => cancelAnimationFrame(frame);
    }, [data, loading, searchParams]);
    const clearedSelection = { recordId: null, recordKind: null, page: '1', focus: null };
    const reset = () => updateView({ node: 'product', kind: 'projects', ...clearedSelection });
    const pickNode = (key: string) => updateView({ node: key, kind: data?.nodes.find(row => row.key === key)?.kind === 'products' ? 'projects' : data?.nodes.find(row => row.key === key)?.kind || 'projects', ...clearedSelection });
    const pickFocus = (key: string, level: TwinFocus) => {
        updateView({ node: key, kind: data?.nodes.find(row => row.key === key)?.kind || kind, ...clearedSelection, focus: level });
        requestAnimationFrame(() => rootRef.current?.querySelector('#detail-section-chain-detail')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    };
    const pickRecord = (record: TwinRecord) => {
        if (record.kind === 'products') { reset(); return; }
        const index = (data?.records.filter(row => row.kind === record.kind) || []).findIndex(row => row.id === record.id);
        updateView({ focus: null, recordId: record.id, recordKind: record.kind, kind: record.kind, node: data?.nodes.find(item => item.kind === record.kind)?.key || node, page: String(Math.floor(Math.max(0, index) / pageSize) + 1) });
    };
    const detailSource = () => {
        const next = new URLSearchParams(searchParams);
        next.set('product', productId);
        next.set('scroll', String(Math.round(rootRef.current?.querySelector('.admin-template-detail-page')?.scrollTop || 0)));
        return `/digital-twin?${next}`;
    };
    const openDetail = (record: TwinRecord) => {
        const source = detailSource();
        navigate(source, { replace: true });
        navigate(appendReturnTo(record.url, source));
    };
    const columns: ProColumns<TwinRecord>[] = [
        { title: '对象 / 编号', dataIndex: 'name', width: 290, fixed: 'left', render: (_, record) => <div className="rb-record-cell">{record.url ? <AdminTextAction className="rb-record-title" href={appendReturnTo(record.url, detailSource())} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); openDetail(record); } }} title={record.name}>{record.name}</AdminTextAction> : <span>{record.name}</span>}<span className="rb-record-code">{record.kind === 'tasks' && record.chain.slice(0, -1).some(link => link.kind === 'tasks') ? '子任务 · ' : ''}编号 {record.code}</span></div> },
        { title: '业务归属', dataIndex: 'parentName', width: 230 },
        { title: '状态', dataIndex: 'status', width: 130, render: (_, record) => renderTwinRecordStatus(record) },
        ...(focus ? [{ title: priorityFieldLabel(kind), dataIndex: 'priorityCode', width: 95, render: (_: unknown, record: TwinRecord) => renderTwinRecordPriority(record) }] : []),
        { title: '负责人 / 金额', dataIndex: 'value', width: 170 }
    ];
    const activeKinds = Object.entries(kindNames).filter(([key]) => key !== 'products' && data?.nodes.some(item => item.available && (item.kind === key || (['planStages', 'paymentStages'].includes(key) && item.kind === 'projects'))));
    const detailRows = selectedRecord ? [...(selectedRecord.priorityCode !== null ? [{ label: priorityFieldLabel(selectedRecord.kind), value: renderTwinRecordPriority(selectedRecord) }] : []), { label: '当前状态', value: <span className="rb-detail-status">{renderTwinRecordStatus(selectedRecord)}</span> }, { label: '业务归属', value: selectedRecord.parentName }, { label: '负责人 / 金额', value: selectedRecord.value }, ...(selectedRecord.dueDate ? [{ label: '计划日期', value: selectedRecord.dueDate }] : [])] : group?.rows || [];
    const refresh = () => { void productsQuery.refetch(); if (productId)
        void snapshotQuery.refetch(); };
    return <div ref={rootRef} id="rb-twin" aria-label="产品数字孪生">
    <TemplateDetailPage title={data ? `${data.product.name} · 经营全景` : '数字孪生'} titleCode={<span className="rb-context">{data ? '负责人 ' + data.product.owner : '产品全链路'}</span>} loading={loading} error={error instanceof Error ? error.message : undefined} onRetry={refresh} titleCenter={<div className="rb-controls rb-product-controls"><span>产品</span><AdminSelect className="rb-product-select" aria-label="切换产品" allowClear={false} value={productId || undefined} options={products.map(row => ({ label: row.name, value: row.id }))} onChange={value => { setProduct(String(value)); }}/></div>}>
      {!loading && !error && !products.length ? <TemplateDetailSection title="产品全景"><AdminEmptyState description="暂无产品，创建产品后可在这里查看完整链路"/></TemplateDetailSection> : null}
      {data ? <>
        <section className="rb-metrics" tabIndex={0} aria-label="产品概览">
          {data.groups.map(item => <div className="rb-metric-group" key={item.key}><AdminButton type="text" className="rb-summary-title" aria-pressed={nodeGroups[node] === item.key} onClick={() => pickNode(data.nodes.find(n => n.kind === item.kind)?.key || 'contract')}>{item.title}<span aria-hidden="true">↗</span></AdminButton><div className="rb-group-values">{item.metrics.map(metric => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}<small>{metric.unit}</small></strong></div>)}</div><p>{item.note}</p></div>)}
        </section>
        <TemplateDetailSection title="业务全景" sectionKey="landscape">
          <div className="rb-scene-layout"><TwinGraph nodes={data.nodes} selected={node} view="all" focus={focus} onSelect={pickNode} onFocus={pickFocus}/><div className="rb-side">
            <aside className="rb-detail" aria-label="选中节点详情" aria-live="polite"><div className="rb-detail-kicker">{selectedRecord ? kindNames[selectedRecord.kind] : '全景观察'}</div><h2>{selectedRecord?.name || group?.title || data.product.name}</h2>{!selectedRecord ? <span className="rb-status">{node === 'product' ? '产品全局' : selectedNode?.available ? '汇总与统计口径' : '未获业务授权'}</span> : null}
              <dl>{detailRows.map(row => <div key={row.label} style={{ display: 'contents' }}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
              {selectedRecord ? <div className="rb-business-relations"><strong>业务关联</strong><div className="rb-related-chain" aria-label="选中对象来源链">{selectedRecord.chain.filter(link => !(link.kind === selectedRecord.kind && link.id === selectedRecord.id)).map(link => {
                const related = data.records.find(row => row.id === link.id && row.kind === link.kind);
                return <div className="rb-related-item" key={link.kind + link.id}><span className="rb-related-kind">{link.kind === 'products' ? '所属产品' : link.kind === 'requirements' ? '来源需求' : link.kind === 'projects' ? '所属项目' : link.kind === 'tasks' ? '父任务' : kindNames[link.kind]}</span>{related ? <AdminTextAction onClick={() => pickRecord(related)}>{link.name}</AdminTextAction> : <span>{link.name}</span>}</div>;
              })}</div></div> : <div className="rb-detail-focus"><strong>统计说明</strong><p>{group?.explanation || '点击分类看汇总，点击节点追溯明细。任务、缺陷、工单分别统计。'}</p></div>}
              {selectedRecord?.url ? <div className="rb-detail-actions"><AdminButton block onClick={() => openDetail(selectedRecord)}>查看{kindNames[selectedRecord.kind]}详情 <span aria-hidden="true">↗</span></AdminButton></div> : null}
            </aside>
            <div className="rb-week" aria-label="本周关键变化"><div className="rb-week-title">本周更新{data.attention.length ? <span>{data.attention.length} 条更新</span> : null}</div>{data.attention.length ? groupRecentUpdates(data.attention).map(updateGroup => <div className="rb-update-group" role="group" aria-label={`${kindNames[updateGroup.kind]}更新`} key={updateGroup.kind}><div className="rb-update-heading"><span>{kindNames[updateGroup.kind]}</span><small aria-label={`${updateGroup.records.length} 条更新`}>{updateGroup.records.length}</small></div><div className="rb-update-records">{updateGroup.records.map(record => <AdminButton type="text" className="rb-event" title={record.name} key={record.kind + record.id} onClick={() => pickRecord(record)}><strong>{record.name}</strong><span className="rb-update-date">{record.updatedAt.slice(5, 10).replace('-', '.')}</span></AdminButton>)}</div></div>) : <div className="rb-context">本周暂无业务记录更新</div>}</div>
          </div></div>
        </TemplateDetailSection>
        <TemplateDetailTableSection title="链路明细" sectionKey="chain-detail" summary={<>{records.length} 个对象{focus ? <span className="rb-focus-filter">{focusLabel(kind, focus)} · 未结束<AdminTextAction onClick={() => updateView({ ...clearedSelection })}>查看全部</AdminTextAction></span> : null}</>} extra={<div className="rb-controls"><span>对象</span><AdminSelect aria-label="明细对象" allowClear={false} value={kind} options={activeKinds.map(([value, label]) => ({ value, label }))} onChange={value => { updateView({ kind: String(value), node: data.nodes.find(item => item.kind === value)?.key || node, ...clearedSelection }); }}/></div>} pagination={{ current: resolvedPage + 1, pageSize, pageSizeOptions: [6, 12, 24], total: records.length, onChange: (current, size) => { updateView({ pageSize: String(size), page: String(size === pageSize ? current : 1) }); } }} table={{ columns, rowKey: 'id', dataSource: records.slice(resolvedPage * pageSize, (resolvedPage + 1) * pageSize), scroll: { x: focus ? 915 : 820 }, size: 'small', rowClassName: record => record.id === selectedRecord?.id && record.kind === selectedRecord.kind ? 'is-selected' : '' }}/>
      </> : null}
    </TemplateDetailPage>
  </div>;
}
