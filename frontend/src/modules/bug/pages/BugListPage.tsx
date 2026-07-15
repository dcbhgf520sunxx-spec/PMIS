import { useEffect, useMemo, useState } from 'react';
import type { Key } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { App } from 'antd';
import { ActionBar, AdminButton, AdminInput, AdminRangePicker, AdminSelect, AdminTextAction, CompactFilterBar, createDetailNeighborContext, createListFilterItems, DeleteConfirmAction, DetailLinkCell, OperationColumnActions, PermissionButton, saveDetailNeighborContext, TemplateListPage, useCommittedFilters, useTemplateServerListData, ViewTabs , listRouteCodecs, useListViewState, usePageReturnNavigation } from '../../../components/admin';
import { deleteBug, getBugList, getBugProjectOptions, getBugRequirementOptions, updateBugStatus } from '../../../api/bugApi';
import { getUserOptions } from '../../../api/userApi';
import { getArchiveOptionsByTypeName } from '../../../api/archiveApi';
import { BugStatusChangeAction } from '../components/BugStatusChangeAction';
import { bugStatusLabels } from '../statusTransitions';
import { renderBugSeverity, renderBugSourceType, renderBugStatus } from '../helpers';
import { useBugBatchActions } from './useBugBatchActions';
import type { BugRecord } from '../types';
import './BugListPage.css';

type Option = { label: string; value: string };
const defaults = { title: '', sourceType: undefined as number | undefined, projectId: undefined as string | undefined, requirementId: undefined as string | undefined, bugTypeId: undefined as string | undefined, severity: undefined as number | undefined, status: undefined as number | undefined, assigneeId: undefined as string | undefined, creatorId: undefined as string | undefined, createdAtRange: [] as unknown[] };
const date = (value: any) => value?.format?.('YYYY-MM-DD');

export function BugListPage() {
  const { currentPath, navigateWithReturn: navigate } = usePageReturnNavigation('/bugs'); const { message } = App.useApp();
  const [view, setView] = useListViewState<'all' | 'mine'>('mine', ['all', 'mine'], true);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]); const [projects, setProjects] = useState<Option[]>([]); const [requirements, setRequirements] = useState<Option[]>([]); const [users, setUsers] = useState<Option[]>([]); const [bugTypes, setBugTypes] = useState<Option[]>([]); const [resolutions, setResolutions] = useState<Option[]>([]);
  const [optionsError, setOptionsError] = useState(''); const [optionsRevision, setOptionsRevision] = useState(0);
  const filters = useCommittedFilters(defaults, { urlSync: true, codecs: { title: listRouteCodecs.string, sourceType: listRouteCodecs.number, projectId: listRouteCodecs.string, requirementId: listRouteCodecs.string, bugTypeId: listRouteCodecs.string, severity: listRouteCodecs.number, status: listRouteCodecs.number, assigneeId: listRouteCodecs.string, creatorId: listRouteCodecs.string, createdAtRange: listRouteCodecs.dateArray } });
  const list = useTemplateServerListData<BugRecord, { viewCounts: { all: number; mine: number } }>({
    queryKey: ['bugs', filters.appliedFilters, filters.revision, view],
    request: async ({ current, pageSize, sortField, sortOrder }) => {
      const range = filters.appliedFilters.createdAtRange || [];
      const assigneeId = view === 'all' ? filters.appliedFilters.assigneeId : undefined;
      const result = await getBugList({ view, title: filters.appliedFilters.title || undefined, source_type: filters.appliedFilters.sourceType, project_id: filters.appliedFilters.projectId, requirement_id: filters.appliedFilters.requirementId, bug_type_id: filters.appliedFilters.bugTypeId, severity: filters.appliedFilters.severity, status: filters.appliedFilters.status, assignee_id: assigneeId, filter_assignee_id: assigneeId, creator_id: filters.appliedFilters.creatorId, created_at_from: date(range[0]), created_at_to: date(range[1]), sort_field: sortField, sort_order: sortOrder, page: current, pageSize });
      return { list: result.list, total: result.total, meta: { viewCounts: result.viewCounts } };
    },
    urlSync: true
  });
  const load = list.reload;
  const counts = list.meta?.viewCounts ?? { all: 0, mine: 0 };

  useEffect(() => {
    let cancelled = false;
    Promise.all([getBugProjectOptions(), getBugRequirementOptions(), getUserOptions(), getArchiveOptionsByTypeName('Bug类型'), getArchiveOptionsByTypeName('Bug解决方案')]).then(([p, r, u, types, resolutionOptions]) => {
      if (cancelled) return; setProjects(p); setRequirements(r); setUsers(u); setBugTypes(types); setResolutions(resolutionOptions); setOptionsError('');
    }).catch((cause) => { if (!cancelled) setOptionsError(cause instanceof Error ? cause.message : '筛选选项加载失败'); });
    return () => { cancelled = true; };
  }, [optionsRevision]);

  const buildQuery = () => { const range = filters.appliedFilters.createdAtRange || []; const assigneeId = view === 'all' ? filters.appliedFilters.assigneeId : undefined; return { view, title: filters.appliedFilters.title || undefined, source_type: filters.appliedFilters.sourceType, project_id: filters.appliedFilters.projectId, requirement_id: filters.appliedFilters.requirementId, bug_type_id: filters.appliedFilters.bugTypeId, severity: filters.appliedFilters.severity, status: filters.appliedFilters.status, assignee_id: assigneeId, filter_assignee_id: assigneeId, creator_id: filters.appliedFilters.creatorId, created_at_from: date(range[0]), created_at_to: date(range[1]), sort_field: list.sortState.field, sort_order: list.sortState.order }; };
  const selectedRecords = useMemo(() => { const map = new Map(list.sortedRows.map((row) => [row.id, row])); return selectedRowKeys.map((key) => map.get(String(key))).filter((row): row is BugRecord => Boolean(row)); }, [selectedRowKeys, list.sortedRows]);
  const sameStatus = selectedRecords.length > 0 && selectedRecords.every((row) => row.status === selectedRecords[0].status); const clearSelection = () => setSelectedRowKeys([]); const batch = useBugBatchActions({ selectedRecords, users, clearSelection, reload: load });
  const openDetail = (row: BugRecord) => { saveDetailNeighborContext(createDetailNeighborContext({ moduleKey: 'bug', routeBase: '/bugs', sourcePath: currentPath, params: buildQuery() })); navigate(`/bugs/${row.id}`); };
  const sortOrder = (field: string) => list.sortState.field === field ? list.sortState.order : null;
  const statusExtra = (values: Record<string, unknown>) => ({ resolvedTime: date(values.resolvedTime), closedTime: date(values.closedTime), resolutionId: values.resolutionId as string | undefined, activationReason: values.activationReason as string | undefined });

  const columns: ProColumns<BugRecord>[] = [
    { title: '序号', width: 60, fixed: 'left', render: (_, __, index) => list.renderIndex(index) },
    { title: 'Bug标题', dataIndex: 'title', width: 260, fixed: 'left', sorter: true, sortOrder: sortOrder('title'), render: (_, row) => <DetailLinkCell title={row.title} onClick={() => openDetail(row)}>{row.title}</DetailLinkCell> },
    { title: '关联对象', dataIndex: 'sourceName', width: 220, sorter: true, sortOrder: sortOrder('sourceName'), render: (_, row) => <div className="bug-source-cell">{renderBugSourceType(row.sourceType)}<span>{row.sourceType === 1 ? row.projectName : row.requirementName}</span></div> },
    { title: '指派给', dataIndex: 'assigneeName', width: 110, sorter: true, sortOrder: sortOrder('assigneeName') },
    { title: 'Bug类型', dataIndex: 'bugTypeName', width: 120, sorter: true, sortOrder: sortOrder('bugTypeName') },
    { title: '严重程度', dataIndex: 'severity', width: 110, sorter: true, sortOrder: sortOrder('severity'), render: (_, row) => renderBugSeverity(row.severity) },
    { title: '状态', dataIndex: 'status', width: 110, sorter: true, sortOrder: sortOrder('status'), render: (_, row) => renderBugStatus(row.status) },
    { title: '创建人', dataIndex: 'creatorName', width: 100, sorter: true, sortOrder: sortOrder('creatorName') },
    { title: '创建时间', dataIndex: 'createdAt', width: 170, sorter: true, sortOrder: sortOrder('createdAt') },
    { title: '操作', valueType: 'option', width: 190, fixed: 'right', render: (_, row) => <OperationColumnActions><AdminTextAction onClick={() => navigate(`/bugs/${row.id}/edit`)}>编辑</AdminTextAction><BugStatusChangeAction variant="text" bug={row} resolutionOptions={resolutions} onConfirm={async (status, values) => { await updateBugStatus(row.id, status, statusExtra(values)); message.success('状态更新成功'); await load(); }}>状态变更</BugStatusChangeAction><AdminTextAction onClick={() => navigate(`/bugs/${row.id}/copy`)}>复制</AdminTextAction><DeleteConfirmAction variant="text" entityName="BUG" targetName={row.title} onConfirm={async () => { await deleteBug(row.id); await load(); }}>删除</DeleteConfirmAction></OperationColumnActions> }
  ];

  const items = createListFilterItems([
    { key: 'title', label: 'Bug标题', node: <AdminInput size="small" value={filters.draftFilters.title} onChange={(event) => filters.setDraftFilters((prev) => ({ ...prev, title: event.target.value }))} onPressEnter={filters.commitFilters} /> },
    { key: 'sourceType', label: '关联类型', node: <AdminSelect size="small" value={filters.draftFilters.sourceType} options={[{ label: '项目', value: 1 }, { label: '需求', value: 2 }]} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, sourceType: value, projectId: undefined, requirementId: undefined }))} /> },
    { key: 'projectId', label: '关联项目', hidden: filters.draftFilters.sourceType !== 1, node: <AdminSelect size="small" value={filters.draftFilters.projectId} options={projects} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, projectId: value }))} /> },
    { key: 'requirementId', label: '关联需求', hidden: filters.draftFilters.sourceType !== 2, node: <AdminSelect size="small" value={filters.draftFilters.requirementId} options={requirements} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, requirementId: value }))} /> },
    { key: 'bugTypeId', label: 'Bug类型', node: <AdminSelect size="small" value={filters.draftFilters.bugTypeId} options={bugTypes} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, bugTypeId: value }))} /> },
    { key: 'severity', label: '严重程度', node: <AdminSelect size="small" value={filters.draftFilters.severity} options={[{ label: '低', value: 1 }, { label: '中', value: 2 }, { label: '高', value: 3 }, { label: '致命', value: 4 }]} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, severity: value }))} /> },
    { key: 'status', label: '状态', node: <AdminSelect size="small" value={filters.draftFilters.status} options={Object.entries(bugStatusLabels).map(([value, label]) => ({ value: Number(value), label }))} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, status: value }))} /> },
    { key: 'assigneeId', label: '指派给', hidden: view !== 'all', node: <AdminSelect size="small" value={filters.draftFilters.assigneeId} options={users} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, assigneeId: value }))} /> },
    { key: 'creatorId', label: '创建人', node: <AdminSelect size="small" value={filters.draftFilters.creatorId} options={users} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, creatorId: value }))} /> },
    { key: 'createdAtRange', label: '创建时间', wide: true, node: <AdminRangePicker size="small" value={filters.draftFilters.createdAtRange as never} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, createdAtRange: value || [] }))} /> }
  ]);
  const retry = () => { setOptionsRevision((value) => value + 1); void load(); };
  return <><TemplateListPage<BugRecord> mode="batch" title="BUG管理" error={list.error || optionsError} onRetry={retry}
    titleExtra={<ViewTabs showCounts value={view} onChange={(next) => { setView(next); clearSelection(); }} items={[{ label: '全部BUG', value: 'all', count: counts.all }, { label: '我的BUG', value: 'mine', count: counts.mine }]} />}
    actions={<ActionBar><PermissionButton permission="bug" type="primary" onClick={() => navigate('/bugs/new')}>新增BUG</PermissionButton></ActionBar>}
    filter={<CompactFilterBar visibleCount={4} items={items} onSearch={() => { filters.commitFilters(); clearSelection(); }} onReset={() => { filters.resetFilters(); clearSelection(); }} />}
    table={{ columns, dataSource: list.pagedRows, loading: list.loading, pagination: false, search: false, rowSelection: { selectedRowKeys, onChange: setSelectedRowKeys }, tableAlertRender: false, onChange: list.handleTableChange, scroll: { x: 1450 } }}
    batch={{ selectedCount: selectedRecords.length, actions: <>{batch.assignAction}{sameStatus ? <BugStatusChangeAction size="small" bug={selectedRecords[0]} resolutionOptions={resolutions} onConfirm={async (status, values) => { await Promise.all(selectedRecords.map((row) => updateBugStatus(row.id, status, statusExtra(values)))); message.success(`成功变更 ${selectedRecords.length} 项 BUG 状态`); clearSelection(); await load(); }}>批量状态变更</BugStatusChangeAction> : <AdminButton size="small" disabled title="请选择状态相同的 BUG">批量状态变更</AdminButton>}{batch.deleteAction}</> }} pagination={list.pagination}
  />{batch.assignModal}</>;
}
