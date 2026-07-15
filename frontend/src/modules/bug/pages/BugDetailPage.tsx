import { useEffect, useState } from 'react';
import { App } from 'antd';
import { useParams } from 'react-router-dom';
import { DeleteConfirmAction, DetailMetaList, DetailNeighborNav, HistoryTimelineSection, PermissionButton, RichTextViewer, TemplateDetailPage, TemplateDetailSection, useDetailNeighbors , usePageReturnNavigation } from '../../../components/admin';
import { deleteBug, getBug, getBugHistory, getBugNeighbors, updateBugStatus } from '../../../api/bugApi';
import { getArchiveOptionsByTypeName } from '../../../api/archiveApi';
import { BugStatusChangeAction } from '../components/BugStatusChangeAction';
import { renderBugSeverity, renderBugStatus } from '../helpers';
import type { BugRecord } from '../types';

type Option = { label: string; value: string };
export function BugDetailPage() {
  const { navigateWithReturn, returnToSource } = usePageReturnNavigation('/bugs'); const params = useParams(); const { message } = App.useApp();
  const [row, setRow] = useState<BugRecord>(); const [history, setHistory] = useState<any[]>([]); const [resolutions, setResolutions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notFound, setNotFound] = useState(false); const [revision, setRevision] = useState(0);
  const neighbors = useDetailNeighbors({ id: params.id, moduleKey: 'bug', routeBase: '/bugs', fetchNeighbors: getBugNeighbors });
  useEffect(() => {
    if (!params.id) return undefined;
    let cancelled = false; setLoading(true); setError(''); setNotFound(false); setRow(undefined); setHistory([]);
    Promise.all([getBug(params.id), getBugHistory(params.id), getArchiveOptionsByTypeName('Bug解决方案')]).then(([bug, items, options]) => {
      if (cancelled) return;
      setRow(bug);
      setResolutions(options);
      setHistory(items.map((item: any) => ({
        id: String(item.id),
        operator: item.operator,
        action: item.action,
        time: String(item.created_at).slice(0, 19).replace('T', ' '),
        changes: (item.changes || []).map((change: any) => ({ field: change.field_name || '-', before: change.old_value, after: change.new_value }))
      })));
    }).catch((cause) => { if (cancelled) return; const text = cause instanceof Error ? cause.message : '加载失败'; text.includes('不存在') ? setNotFound(true) : setError(text); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params.id, revision]);
  const date = (value: any) => value?.format?.('YYYY-MM-DD');
  return <TemplateDetailPage title="BUG详情" loading={loading} error={error} notFound={notFound} onRetry={() => setRevision((value) => value + 1)} onBack={returnToSource}
    titleCenter={<DetailNeighborNav placement="title" loading={neighbors.loading} prevId={neighbors.prevId} nextId={neighbors.nextId} ordinal={neighbors.ordinal} total={neighbors.total} onNavigate={neighbors.navigateNeighbor} />}
    actions={row ? <><PermissionButton permission="bug" type="primary" onClick={() => navigateWithReturn(`/bugs/${row.id}/edit`)}>编辑</PermissionButton><DeleteConfirmAction entityName="BUG" targetName={row.title} onConfirm={async () => { await deleteBug(row.id); returnToSource(); }}>删除</DeleteConfirmAction></> : null}
    statusSection={row ? { items: [{ label: 'Bug状态', value: renderBugStatus(row.status), wide: true }, { label: '严重程度', value: renderBugSeverity(row.severity), wide: true }] } : null}
    statusAction={row ? <BugStatusChangeAction block type="primary" bug={row} resolutionOptions={resolutions} onConfirm={async (status, values) => { await updateBugStatus(row.id, status, { resolvedTime: date(values.resolvedTime), closedTime: date(values.closedTime), resolutionId: values.resolutionId as string | undefined, activationReason: values.activationReason as string | undefined }); message.success('状态更新成功'); setRevision((value) => value + 1); }} /> : null}
    documentSection={row ? { items: [{ label: '创建人', value: row.creatorName }, { label: '创建时间', value: row.createdAt, wide: true }, { label: '更新人', value: row.updaterName }, { label: '更新时间', value: row.updatedAt, wide: true }] } : null}
  >{row ? <>
    <TemplateDetailSection title="基本信息"><DetailMetaList items={[{ label: 'Bug标题', value: row.title, wide: true }, { label: 'Bug描述', value: <RichTextViewer value={row.description || '暂无描述'} />, wide: true }, { label: '关联类型', value: row.sourceType === 1 ? '项目' : '需求' }, { label: '关联对象', value: row.sourceType === 1 ? row.projectName : row.requirementName }, { label: 'Bug类型', value: row.bugTypeName }]} /></TemplateDetailSection>
    <TemplateDetailSection title="处理信息"><DetailMetaList items={[{ label: '指派给', value: row.assigneeName }, { label: '修复时间', value: row.resolvedTime || '-' }, { label: '解决方案', value: row.resolutionName }, { label: '关闭时间', value: row.closedTime || '-' }, { label: '激活原因', value: row.activationReason || '-', wide: true }]} /></TemplateDetailSection>
    <HistoryTimelineSection items={history} />
  </> : null}</TemplateDetailPage>;
}
