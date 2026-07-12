import { useEffect, useState } from 'react';
import { App } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { DetailMetaList, HistoryTimeline, OverdueTag, PermissionButton, RichTextViewer, TemplateDetailPage, TemplateDetailSection } from '../../../components/admin';
import { getProject, getProjectHistory, updateProjectStatus } from '../../../api/projectApi';
import type { ProjectRecord, ProjectStatus } from '../types';
import { ProjectStatusChangeAction, renderProjectStatus } from '../components/ProjectStatusChangeAction';

const dateValue = (value: unknown) => value && typeof value === 'object' && 'format' in value && typeof value.format === 'function' ? value.format('YYYY-MM-DD') : undefined;

export function ProjectDetailPage() {
  const navigate = useNavigate(); const params = useParams(); const { message } = App.useApp();
  const [row, setRow] = useState<ProjectRecord>(); const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notFound, setNotFound] = useState(false); const [revision, setRevision] = useState(0);
  const load = () => {
    if (!params.id) return;
    setLoading(true);
    Promise.all([
      getProject(params.id).then(setRow),
      getProjectHistory(params.id).then((items) => setHistory(items.map((item) => ({ id: String(item.id), operator: item.operator, action: item.action, time: String(item.created_at).slice(0, 19).replace('T', ' '), changes: item.field_name ? [{ field: item.field_name, before: item.old_value, after: item.new_value }] : undefined }))))
    ]).catch((loadError) => { const text = loadError instanceof Error ? loadError.message : '加载失败'; if (text.includes('不存在')) setNotFound(true); else setError(text); }).finally(() => setLoading(false));
  };
  useEffect(load, [params.id, revision]);
  return <TemplateDetailPage title="项目详情" loading={loading} error={error} notFound={notFound} onRetry={() => setRevision((value) => value + 1)} onBack={() => navigate('/projects')}
    titleTags={row ? renderProjectStatus(row.status) : null}
    actions={row ? <PermissionButton permission="project" type="primary" onClick={() => navigate(`/projects/${row.id}/edit`)}>编辑</PermissionButton> : null}
    statusSection={row ? { items: [{ label: '项目状态', value: renderProjectStatus(row.status), wide: true }, { label: '逾期状态', value: <OverdueTag overdueDays={row.isOverdue ? 1 : 0} />, wide: true }] } : null}
    statusAction={row ? <ProjectStatusChangeAction block type="primary" project={row} onConfirm={async (status, values) => { await updateProjectStatus(row.id, status, status === 2 ? { actual_end_date: dateValue(values.actualEndDate) } : status === 3 ? { suspend_date: dateValue(values.suspendDate) } : {}); message.success('状态更新成功'); load(); }} /> : null}
    documentSection={row ? { items: [{ label: '创建人', value: row.creatorName }, { label: '创建时间', value: row.createdAt, wide: true }, { label: '更新人', value: row.updaterName }, { label: '更新时间', value: row.updatedAt, wide: true }] } : null}>
    {row ? <><TemplateDetailSection title="基本信息"><DetailMetaList items={[{ label: '项目名称', value: row.name }, { label: '所属产品', value: row.productName }, { label: '负责人', value: row.ownerName }, { label: '项目成员', value: row.members.map((member) => member.name).join('、') || '-' }, { label: '启动日期', value: row.startDate || '-' }, { label: '预计完成日期', value: row.expectedEndDate }, { label: '实际完成日期', value: row.actualEndDate || '-' }, { label: '暂停日期', value: row.suspendDate || '-' }]} /></TemplateDetailSection><TemplateDetailSection title="项目描述"><RichTextViewer value={row.description || '暂无描述'} /></TemplateDetailSection><TemplateDetailSection title="进展与风险"><DetailMetaList items={[{ label: '进度记录', value: row.progressText || '-', wide: true }, { label: '风险记录', value: row.riskText || '-', wide: true }]} /></TemplateDetailSection><TemplateDetailSection title="操作历史"><HistoryTimeline items={history} /></TemplateDetailSection></> : null}
  </TemplateDetailPage>;
}
