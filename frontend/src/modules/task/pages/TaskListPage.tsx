import { useEffect, useMemo, useState } from 'react';
import type { Key } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { App } from 'antd';
import { ActionBar, AdminButton, AdminInput, AdminRangePicker, AdminSelect, AdminTextAction, CompactFilterBar, createDetailNeighborContext, createListFilterItems, DeleteConfirmAction, DetailLinkCell, ExpandToggleButton, OperationColumnActions, PermissionButton, saveDetailNeighborContext, TemplateListPage, useCommittedFilters, useTemplateServerListData, ViewTabs , listRouteCodecs, useListViewState, usePageReturnNavigation } from '../../../components/admin';
import { deleteTask, getTaskList, getTaskProjectOptions, getTaskRequirementOptions, updateTaskStatus } from '../../../api/taskApi';
import { getUserOptions } from '../../../api/userApi';
import { getArchiveOptionsByTypeName } from '../../../api/archiveApi';
import type { TaskRecord } from '../types';
import { taskStatusLabels } from '../statusTransitions';
import { TaskStatusChangeAction } from '../components/TaskStatusChangeAction';
import { renderTaskLevel, renderTaskOverdue, renderTaskPriority, renderTaskSourceType, renderTaskStatus } from '../helpers';
import { useTaskBatchActions } from './useTaskBatchActions';
import './TaskListPage.css';

type Option = { label: string; value: string };
const defaults = {
  name: '',
  sourceType: undefined as number | undefined,
  projectId: undefined as string | undefined,
  requirementId: undefined as string | undefined,
  taskType: undefined as string | undefined,
  priority: undefined as number | undefined,
  status: undefined as number | undefined,
  isOverdue: undefined as number | undefined,
  ownerId: undefined as string | undefined,
  expectedEndTimeRange: [] as unknown[]
};
const date = (value: any) => value?.format?.('YYYY-MM-DD');

export function TaskListPage() {
  const { currentPath, navigateWithReturn: navigate } = usePageReturnNavigation('/tasks');
  const { message, modal } = App.useApp();
  const [view, setView] = useListViewState<'all' | 'mine'>('mine', ['all', 'mine'], true);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(() => new Set());
  const [projects, setProjects] = useState<Option[]>([]);
  const [requirements, setRequirements] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [taskTypes, setTaskTypes] = useState<Option[]>([]);
  const [optionsError, setOptionsError] = useState('');
  const [optionsRevision, setOptionsRevision] = useState(0);
  const filters = useCommittedFilters(defaults, { urlSync: true, codecs: { name: listRouteCodecs.string, sourceType: listRouteCodecs.number, projectId: listRouteCodecs.string, requirementId: listRouteCodecs.string, taskType: listRouteCodecs.string, priority: listRouteCodecs.number, status: listRouteCodecs.number, isOverdue: listRouteCodecs.number, ownerId: listRouteCodecs.string, expectedEndTimeRange: listRouteCodecs.dateArray } });
  const list = useTemplateServerListData<TaskRecord, { viewCounts: { all: number; mine: number } }>({
    queryKey: ['tasks', filters.appliedFilters, filters.revision, view],
    request: async ({ current, pageSize, sortField, sortOrder }) => {
      const expectedRange = filters.appliedFilters.expectedEndTimeRange || [];
      const ownerId = view === 'all' ? filters.appliedFilters.ownerId : undefined;
      const result = await getTaskList({ view, name: filters.appliedFilters.name || undefined, source_type: filters.appliedFilters.sourceType, project_id: filters.appliedFilters.projectId, requirement_id: filters.appliedFilters.requirementId, task_type: filters.appliedFilters.taskType, priority: filters.appliedFilters.priority, status: filters.appliedFilters.status, is_overdue: filters.appliedFilters.isOverdue, owner_id: ownerId, filter_owner_id: ownerId, expected_end_date_from: date(expectedRange[0]), expected_end_date_to: date(expectedRange[1]), sort_field: sortField, sort_order: sortOrder, page: current, pageSize });
      return { list: result.list, total: result.total, meta: { viewCounts: result.viewCounts } };
    },
    urlSync: true
  });
  const load = list.reload;
  const counts = list.meta?.viewCounts ?? { all: 0, mine: 0 };

  useEffect(() => {
    let cancelled = false;
    Promise.all([getTaskProjectOptions(), getTaskRequirementOptions(), getUserOptions(), getArchiveOptionsByTypeName('任务类型')])
      .then(([projectOptions, requirementOptions, userOptions, typeOptions]) => {
        if (cancelled) return;
        setProjects(projectOptions);
        setRequirements(requirementOptions);
        setUsers(userOptions);
        setTaskTypes(typeOptions);
        setOptionsError('');
      })
      .catch((loadError) => {
        if (!cancelled) setOptionsError(loadError instanceof Error ? loadError.message : '筛选选项加载失败');
      });
    return () => { cancelled = true; };
  }, [optionsRevision]);

  const buildQuery = () => {
    const expectedRange = filters.appliedFilters.expectedEndTimeRange || [];
    const ownerId = view === 'all' ? filters.appliedFilters.ownerId : undefined;
    return {
      view,
      name: filters.appliedFilters.name || undefined,
      source_type: filters.appliedFilters.sourceType,
      project_id: filters.appliedFilters.projectId,
      requirement_id: filters.appliedFilters.requirementId,
      task_type: filters.appliedFilters.taskType,
      priority: filters.appliedFilters.priority,
      status: filters.appliedFilters.status,
      is_overdue: filters.appliedFilters.isOverdue,
      owner_id: ownerId,
      filter_owner_id: ownerId,
      expected_end_date_from: date(expectedRange[0]),
      expected_end_date_to: date(expectedRange[1]),
      sort_field: list.sortState.field,
      sort_order: list.sortState.order
    };
  };

  const selectedRecords = useMemo(() => {
    const rowMap = new Map(list.sortedRows.map((row) => [row.id, row]));
    return selectedRowKeys.map((key) => rowMap.get(String(key))).filter((row): row is TaskRecord => Boolean(row));
  }, [selectedRowKeys, list.sortedRows]);
  const sameStatus = selectedRecords.length > 0 && selectedRecords.every((row) => row.status === selectedRecords[0].status);
  const clearSelection = () => setSelectedRowKeys([]);
  const batch = useTaskBatchActions({ selectedRecords, users, clearSelection, reload: load });
  const visibleRows = useMemo(
    () => list.pagedRows.filter((row) => !row.parentTaskId || expandedParentIds.has(row.parentTaskId)),
    [expandedParentIds, list.pagedRows]
  );

  const toggleTaskGroup = (parentTaskId: string) => {
    const nextExpanded = !expandedParentIds.has(parentTaskId);
    setExpandedParentIds((current) => {
      const next = new Set(current);
      if (nextExpanded) next.add(parentTaskId);
      else next.delete(parentTaskId);
      return next;
    });
    if (!nextExpanded) {
      const childIds = new Set(list.pagedRows.filter((row) => row.parentTaskId === parentTaskId).map((row) => row.id));
      setSelectedRowKeys((current) => current.filter((key) => !childIds.has(String(key))));
    }
  };

  const openDetail = (row: TaskRecord) => {
    saveDetailNeighborContext(createDetailNeighborContext({ moduleKey: 'task', routeBase: '/tasks', sourcePath: currentPath, params: buildQuery() }));
    navigate(`/tasks/${row.id}`);
  };
  const promptParentCompletion = (parentTaskId: string) => modal.confirm({
    title: '子任务已全部完成',
    content: '所有子任务均已完成，可以将主任务标记为已完成。',
    okText: '去变更主任务状态',
    cancelText: '暂不处理',
    onOk: () => navigate(`/tasks/${parentTaskId}`)
  });
  const sortOrder = (field: string) => list.sortState.field === field ? list.sortState.order : null;

  const columns: ProColumns<TaskRecord>[] = [
    { title: '序号', width: 60, fixed: 'left', render: (_, __, index) => list.renderIndex(index) },
    { title: '任务名称', dataIndex: 'name', width: 320, fixed: 'left', sorter: true, sortOrder: sortOrder('name'), render: (_, row) => <div className={`task-name-cell${row.parentTaskId ? ' task-name-cell--subtask' : ''}`}>{row.childCount > 0 ? <><ExpandToggleButton className="task-name-cell__toggle" variant="square" expanded={expandedParentIds.has(row.id)} expandLabel={`展开 ${row.name} 的子任务`} collapseLabel={`收起 ${row.name} 的子任务`} onClick={() => toggleTaskGroup(row.id)} />{renderTaskLevel()}</> : row.parentTaskId ? renderTaskLevel(row.parentTaskId) : null}<DetailLinkCell className="task-name-cell__text" title={row.name} onClick={() => openDetail(row)}>{row.name}</DetailLinkCell>{row.isOverdue ? <span className="task-name-cell__tag">{renderTaskOverdue(true, row.expectedEndTime)}</span> : null}</div> },
    { title: '关联对象', dataIndex: 'sourceName', width: 220, sorter: true, sortOrder: sortOrder('sourceName'), render: (_, row) => <div className="task-source-cell">{renderTaskSourceType(row.sourceType)}<span>{row.sourceType === 1 ? row.projectName : row.requirementName}</span></div> },
    { title: '负责人', dataIndex: 'ownerNames', width: 160, sorter: true, sortOrder: sortOrder('ownerNames') },
    { title: '任务类型', dataIndex: 'taskTypeName', width: 110, sorter: true, sortOrder: sortOrder('taskTypeName') },
    { title: '优先级', dataIndex: 'priority', width: 90, sorter: true, sortOrder: sortOrder('priority'), render: (_, row) => renderTaskPriority(row.priority) },
    { title: '状态', dataIndex: 'status', width: 100, sorter: true, sortOrder: sortOrder('status'), render: (_, row) => renderTaskStatus(row.status) },
    { title: '预计完成时间', dataIndex: 'expectedEndTime', width: 140, sorter: true, sortOrder: sortOrder('expectedEndTime'), render: (_, row) => row.expectedEndTime || '-' },
    { title: '创建人', dataIndex: 'creatorName', width: 100, sorter: true, sortOrder: sortOrder('creatorName') },
    { title: '创建时间', dataIndex: 'createdAt', width: 170, sorter: true, sortOrder: sortOrder('createdAt') },
    { title: '操作', valueType: 'option', width: 190, fixed: 'right', render: (_, row) => <OperationColumnActions><AdminTextAction onClick={() => navigate(`/tasks/${row.id}/edit`)}>编辑</AdminTextAction><TaskStatusChangeAction variant="text" task={row} onConfirm={async (status, values) => { const result = await updateTaskStatus(row.id, status, status === 2 ? { actual_end_date: date(values.actualEndTime) } : status === 3 ? { suspend_date: date(values.suspendTime) } : {}); message.success('状态更新成功'); await load(); if (result.allSubtasksCompleted) promptParentCompletion(result.parentTaskId); }}>状态变更</TaskStatusChangeAction>{!row.parentTaskId ? <AdminTextAction onClick={() => navigate(`/tasks/${row.id}/subtasks/new`)}>新增子任务</AdminTextAction> : null}<AdminTextAction onClick={() => navigate(`/tasks/${row.id}/copy`)}>复制</AdminTextAction><DeleteConfirmAction variant="text" entityName="任务" targetName={row.name} onConfirm={async () => { await deleteTask(row.id); await load(); }}>删除</DeleteConfirmAction></OperationColumnActions> }
  ];

  const items = createListFilterItems([
    { key: 'name', label: '任务名称', node: <AdminInput size="small" value={filters.draftFilters.name} onChange={(event) => filters.setDraftFilters((prev) => ({ ...prev, name: event.target.value }))} onPressEnter={() => { filters.commitFilters(); clearSelection(); }} /> },
    { key: 'sourceType', label: '关联类型', node: <AdminSelect size="small" value={filters.draftFilters.sourceType} options={[{ label: '项目', value: 1 }, { label: '需求', value: 2 }]} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, sourceType: value, projectId: undefined, requirementId: undefined }))} /> },
    { key: 'projectId', label: '关联项目', hidden: filters.draftFilters.sourceType !== 1, node: <AdminSelect size="small" value={filters.draftFilters.projectId} options={projects} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, projectId: value }))} /> },
    { key: 'requirementId', label: '关联需求', hidden: filters.draftFilters.sourceType !== 2, node: <AdminSelect size="small" value={filters.draftFilters.requirementId} options={requirements} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, requirementId: value }))} /> },
    { key: 'taskType', label: '任务类型', node: <AdminSelect size="small" value={filters.draftFilters.taskType} options={taskTypes} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, taskType: value }))} /> },
    { key: 'priority', label: '优先级', node: <AdminSelect size="small" value={filters.draftFilters.priority} options={[{ label: '低', value: 0 }, { label: '中', value: 1 }, { label: '高', value: 2 }]} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, priority: value }))} /> },
    { key: 'status', label: '状态', node: <AdminSelect size="small" value={filters.draftFilters.status} options={Object.entries(taskStatusLabels).map(([value, label]) => ({ value: Number(value), label }))} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, status: value }))} /> },
    { key: 'isOverdue', label: '逾期状态', node: <AdminSelect size="small" value={filters.draftFilters.isOverdue} options={[{ label: '已逾期', value: 1 }, { label: '未逾期', value: 0 }]} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, isOverdue: value }))} /> },
    { key: 'ownerId', label: '负责人', hidden: view !== 'all', node: <AdminSelect size="small" value={filters.draftFilters.ownerId} options={users} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, ownerId: value }))} /> },
    { key: 'expectedEndTimeRange', label: '预计完成时间', wide: true, node: <AdminRangePicker size="small" value={filters.draftFilters.expectedEndTimeRange as never} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, expectedEndTimeRange: value || [] }))} /> }
  ]);

  const handleViewChange = (nextView: 'all' | 'mine') => { setView(nextView); clearSelection(); };
  const handleSearch = () => { filters.commitFilters(); clearSelection(); };
  const handleReset = () => { filters.resetFilters(); clearSelection(); };
  const handleRetry = () => { setOptionsRevision((value) => value + 1); void load(); };

  return <>
    <TemplateListPage<TaskRecord>
      mode="batch"
      title="任务管理"
      error={list.error || optionsError}
      onRetry={handleRetry}
      titleExtra={<ViewTabs showCounts value={view} onChange={handleViewChange} items={[{ label: '全部任务', value: 'all', count: counts.all }, { label: '我的任务', value: 'mine', count: counts.mine }]} />}
      actions={<ActionBar><PermissionButton permission="task" type="primary" onClick={() => navigate('/tasks/new')}>新增任务</PermissionButton></ActionBar>}
      filter={<CompactFilterBar visibleCount={4} items={items} onSearch={handleSearch} onReset={handleReset} />}
      table={{ columns, dataSource: visibleRows, loading: list.loading, pagination: false, search: false, rowSelection: { selectedRowKeys, onChange: setSelectedRowKeys }, tableAlertRender: false, onChange: list.handleTableChange, scroll: { x: 1650 } }}
      batch={{
        selectedCount: selectedRecords.length,
        actions: <>
          {batch.assignAction}
          {sameStatus ? <TaskStatusChangeAction size="small" task={selectedRecords[0]} onConfirm={async (status, values) => { const results = await Promise.all(selectedRecords.map((row) => updateTaskStatus(row.id, status, status === 2 ? { actual_end_date: date(values.actualEndTime) } : status === 3 ? { suspend_date: date(values.suspendTime) } : {}))); message.success(`成功变更 ${selectedRecords.length} 项任务状态`); clearSelection(); await load(); const completed = results.find((result) => result.allSubtasksCompleted); if (completed) promptParentCompletion(completed.parentTaskId); }}>批量状态变更</TaskStatusChangeAction> : <AdminButton size="small" disabled title="请选择状态相同的任务">批量状态变更</AdminButton>}
          {batch.deleteAction}
        </>
      }}
      pagination={list.pagination}
    />
    {batch.assignModal}
  </>;
}
