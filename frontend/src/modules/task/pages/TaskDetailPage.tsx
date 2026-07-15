import { useEffect, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { App } from 'antd';
import { useParams } from 'react-router-dom';
import { AdminTextAction, DeleteConfirmAction, DetailLinkCell, DetailMetaList, DetailNeighborNav, HistoryTimelineSection, OperationColumnActions, PermissionButton, RichTextViewer, TemplateDetailPage, TemplateDetailSection, TemplateDetailTableSection, useDetailNeighbors, usePageReturnNavigation } from '../../../components/admin';
import { deleteTask, getSubtasks, getTask, getTaskHistory, getTaskNeighbors, updateTaskStatus } from '../../../api/taskApi';
import type { TaskRecord } from '../types';
import { TaskStatusChangeAction } from '../components/TaskStatusChangeAction';
import { renderTaskLevel, renderTaskOverdue, renderTaskPriority, renderTaskStatus } from '../helpers';

export function TaskDetailPage() {
  const { navigateWithReturn, returnTarget, returnToSource } = usePageReturnNavigation('/tasks');
  const returnsToTaskDetail = /^\/tasks\/[^/?#]+(?:[?#]|$)/.test(returnTarget);
  const params = useParams();
  const { message, modal } = App.useApp();
  const [row, setRow] = useState<TaskRecord>();
  const [subtasks, setSubtasks] = useState<TaskRecord[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [revision, setRevision] = useState(0);
  const neighbors = useDetailNeighbors({ id: params.id, moduleKey: 'task', routeBase: '/tasks', fetchNeighbors: getTaskNeighbors });

  useEffect(() => {
    if (!params.id) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setNotFound(false);
    setRow(undefined);
    setSubtasks([]);
    setHistory([]);
    void (async () => {
      try {
        const task = await getTask(params.id!);
        const [items, children] = await Promise.all([
          getTaskHistory(params.id!),
          task.parentTaskId ? Promise.resolve([]) : getSubtasks(task.id)
        ]);
        if (cancelled) return;
        setRow(task);
        setSubtasks(children);
        setHistory(items.map((item: any) => ({ id: String(item.id), operator: item.operator, action: item.action, time: String(item.created_at).slice(0, 19).replace('T', ' '), changes: (item.changes || []).map((change: any) => ({ field: change.field_name || '-', before: change.old_value, after: change.new_value })) })));
      } catch (cause) {
        if (cancelled) return;
        const text = cause instanceof Error ? cause.message : '加载失败';
        text.includes('不存在') ? setNotFound(true) : setError(text);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params.id, revision]);

  const date = (value: any) => value?.format?.('YYYY-MM-DD');
  const promptParentCompletion = (parentTaskId: string) => modal.confirm({
    title: '子任务已全部完成',
    content: '所有子任务均已完成，可以将主任务标记为已完成。',
    okText: '去变更主任务状态',
    cancelText: '暂不处理',
    onOk: () => navigateWithReturn(`/tasks/${parentTaskId}`)
  });
  const changeStatus = async (task: TaskRecord, status: number, values: any) => {
    const result = await updateTaskStatus(task.id, status as TaskRecord['status'], status === 2 ? { actual_end_date: date(values.actualEndTime) } : status === 3 ? { suspend_date: date(values.suspendTime) } : {});
    message.success('状态更新成功');
    setRevision((value) => value + 1);
    if (result.allSubtasksCompleted) promptParentCompletion(result.parentTaskId);
  };

  const subtaskColumns: ProColumns<TaskRecord>[] = [
    { title: '任务名称', dataIndex: 'name', width: 240, render: (_, task) => <DetailLinkCell title={task.name} onClick={() => navigateWithReturn(`/tasks/${task.id}`)}>{task.name}</DetailLinkCell> },
    { title: '负责人', dataIndex: 'ownerName', width: 100 },
    { title: '任务类型', dataIndex: 'taskTypeName', width: 100 },
    { title: '优先级', dataIndex: 'priority', width: 90, render: (_, task) => renderTaskPriority(task.priority) },
    { title: '状态', dataIndex: 'status', width: 100, render: (_, task) => renderTaskStatus(task.status) },
    { title: '预计完成时间', dataIndex: 'expectedEndTime', width: 140, render: (_, task) => task.expectedEndTime || '-' },
    { title: '实际完成时间', dataIndex: 'actualEndTime', width: 140, render: (_, task) => task.actualEndTime || '-' },
    { title: '操作', valueType: 'option', width: 190, fixed: 'right', render: (_, task) => <OperationColumnActions><AdminTextAction onClick={() => navigateWithReturn(`/tasks/${task.id}/edit`)}>编辑</AdminTextAction><TaskStatusChangeAction variant="text" task={task} onConfirm={(status, values) => changeStatus(task, status, values)}>状态变更</TaskStatusChangeAction><AdminTextAction onClick={() => navigateWithReturn(`/tasks/${task.id}/copy`)}>复制</AdminTextAction><DeleteConfirmAction variant="text" entityName="子任务" targetName={task.name} onConfirm={async () => { await deleteTask(task.id); setRevision((value) => value + 1); }}>删除</DeleteConfirmAction></OperationColumnActions> }
  ];

  return <TemplateDetailPage
    title="任务详情"
    loading={loading}
    error={error}
    notFound={notFound}
    onRetry={() => setRevision((value) => value + 1)}
    onBack={returnToSource}
    backText={returnsToTaskDetail ? '返回' : '返回列表'}
    titleCenter={<DetailNeighborNav placement="title" loading={neighbors.loading} prevId={neighbors.prevId} nextId={neighbors.nextId} ordinal={neighbors.ordinal} total={neighbors.total} onNavigate={neighbors.navigateNeighbor} />}
    actions={row ? <><PermissionButton permission="task" type="primary" onClick={() => navigateWithReturn(`/tasks/${row.id}/edit`)}>编辑</PermissionButton><DeleteConfirmAction entityName="任务" targetName={row.name} onConfirm={async () => { await deleteTask(row.id); returnToSource(); }}>删除</DeleteConfirmAction></> : null}
    statusSection={row ? { items: [{ label: '任务状态', value: renderTaskStatus(row.status), wide: true }, { label: '优先级', value: renderTaskPriority(row.priority), wide: true }, { label: '逾期状态', value: renderTaskOverdue(row.isOverdue, row.expectedEndTime), wide: true }] } : null}
    statusAction={row ? <TaskStatusChangeAction block type="primary" task={row} onConfirm={(status, values) => changeStatus(row, status, values)} /> : null}
    documentSection={row ? { items: [{ label: '创建人', value: row.creatorName }, { label: '创建时间', value: row.createdAt, wide: true }, { label: '更新人', value: row.updaterName }, { label: '更新时间', value: row.updatedAt, wide: true }] } : null}
  >
    {row ? <>
      <TemplateDetailSection title="基本信息"><DetailMetaList items={[{ label: '任务名称', value: row.name, wide: true }, { label: '任务描述', value: <RichTextViewer value={row.description || '暂无描述'} />, wide: true }, ...(row.parentTaskId ? [{ label: '所属主任务', value: <>{renderTaskLevel()}<DetailLinkCell title={row.parentTaskName} onClick={() => navigateWithReturn(`/tasks/${row.parentTaskId}`)}>{row.parentTaskName}</DetailLinkCell></> }] : []), { label: '关联类型', value: row.sourceType === 1 ? '项目' : '需求' }, { label: '关联对象', value: row.sourceType === 1 ? row.projectName : row.requirementName }, { label: '任务类型', value: row.taskTypeName }]} /></TemplateDetailSection>
      <TemplateDetailSection title="处理信息"><DetailMetaList items={[{ label: '负责人', value: row.ownerName }, { label: '启动时间', value: row.startTime || '-' }, { label: '预计完成时间', value: row.expectedEndTime || '-' }, { label: '实际完成时间', value: row.actualEndTime || '-' }, { label: '暂停时间', value: row.suspendTime || '-' }]} /></TemplateDetailSection>
      {!row.parentTaskId ? <TemplateDetailTableSection<TaskRecord> title="子任务" summary={`已完成 ${row.completedChildCount} / 共 ${row.childCount}`} extra={<PermissionButton permission="task" size="small" type="primary" onClick={() => navigateWithReturn(`/tasks/${row.id}/subtasks/new`)}>新增子任务</PermissionButton>} table={{ rowKey: 'id', columns: subtaskColumns, dataSource: subtasks, scroll: { x: 1100 } }} /> : null}
      <HistoryTimelineSection items={history} />
    </> : null}
  </TemplateDetailPage>;
}
