import dayjs from 'dayjs';
import { request, unwrap } from './requestClient';
import { arrayContract, objectContract } from './responseContract';
import type { TaskFormValues, TaskPriority, TaskRecord, TaskStatus, TaskStatusUpdateResult } from '../modules/task/types';

type Row = { id: number; name: string; description?: string; parent_task_id?: number; parent_task_name?: string; child_count?: number; completed_child_count?: number; source_type: 1 | 2; project_id?: number; project_name?: string; requirement_id?: number; requirement_name?: string; owner_id: number; owner_name: string; task_type: number; task_type_name: string; priority: number; status: number; previous_status?: number; is_overdue: number; start_date?: string; expected_end_date?: string; actual_end_date?: string; suspend_date?: string; creator_name?: string; updater_name?: string; created_at?: string; updated_at?: string };
type Page = { list: Row[]; total: number; page: number; pageSize: number; viewCounts: { all: number; mine: number } };

const rowContract = objectContract<Row>(['id', 'name', 'source_type', 'owner_id', 'owner_name', 'task_type', 'task_type_name', 'priority', 'status', 'is_overdue']);
const pageContract = objectContract<Page>(['list', 'total', 'page', 'pageSize', 'viewCounts'], { list: arrayContract(rowContract) });
const neighborsContract = objectContract<{ prevId: number | null; nextId: number | null; ordinal?: number; total?: number }>(['prevId', 'nextId']);
const availableContract = objectContract<{ available: boolean }>(['available']);
const batchResultContract = objectContract<{ updated: number; requested: number }>(['updated', 'requested']);
const statusResultContract = objectContract<{ allSubtasksCompleted: boolean; parentTaskId: number | null }>(['allSubtasksCompleted', 'parentTaskId']);
const projectOptionContract = objectContract<{ id: number; name: string }>(['id', 'name']);
const requirementOptionContract = objectContract<{ id: number; title: string }>(['id', 'title']);
const dateText = (value?: string) => String(value || '').slice(0, 10);
const dateTimeText = (value?: string) => String(value || '').slice(0, 19).replace('T', ' ');

function mapTask(row: Row): TaskRecord {
  return {
    id: String(row.id), name: row.name, description: row.description || '',
    parentTaskId: row.parent_task_id ? String(row.parent_task_id) : '', parentTaskName: row.parent_task_name || '',
    childCount: Number(row.child_count || 0), completedChildCount: Number(row.completed_child_count || 0), sourceType: row.source_type,
    projectId: row.project_id ? String(row.project_id) : '', projectName: row.project_name || '-',
    requirementId: row.requirement_id ? String(row.requirement_id) : '', requirementName: row.requirement_name || '-',
    ownerId: String(row.owner_id), ownerName: row.owner_name, taskType: String(row.task_type), taskTypeName: row.task_type_name,
    priority: Number(row.priority) as TaskPriority, status: Number(row.status) as TaskStatus,
    previousStatus: row.previous_status === undefined ? undefined : Number(row.previous_status) as TaskStatus,
    isOverdue: Boolean(Number(row.is_overdue)), startTime: dateText(row.start_date), expectedEndTime: dateText(row.expected_end_date),
    actualEndTime: dateText(row.actual_end_date), suspendTime: dateText(row.suspend_date), creatorName: row.creator_name || '-',
    updaterName: row.updater_name || '-', createdAt: dateTimeText(row.created_at), updatedAt: dateTimeText(row.updated_at)
  };
}

export async function getTaskList(params: Record<string, unknown> = {}) {
  const result = await unwrap<Page>(request.get('/tasks', { params }), pageContract);
  return { ...result, list: result.list.map(mapTask) };
}

export async function getTask(id: string) {
  return mapTask(await unwrap<Row>(request.get(`/tasks/${id}`), rowContract));
}

export async function getTaskNeighbors(id: string, params: Record<string, unknown> = {}) {
  const result = await unwrap<{ prevId: number | null; nextId: number | null; ordinal?: number; total?: number }>(request.get('/tasks/neighbors', { params: { ...params, id } }), neighborsContract);
  return { prevId: result.prevId === null ? null : String(result.prevId), nextId: result.nextId === null ? null : String(result.nextId), ordinal: result.ordinal, total: result.total };
}

export async function getTaskProjectOptions() {
  const rows = await unwrap<Array<{ id: number; name: string }>>(request.get('/tasks/project-options'), arrayContract(projectOptionContract));
  return rows.map((row) => ({ label: row.name, value: String(row.id) }));
}

export async function getTaskRequirementOptions() {
  const rows = await unwrap<Array<{ id: number; title: string }>>(request.get('/tasks/requirement-options'), arrayContract(requirementOptionContract));
  return rows.map((row) => ({ label: row.title, value: String(row.id) }));
}

export async function checkTaskName(name: string, excludeId?: string) {
  return unwrap<{ available: boolean }>(request.get('/tasks/check-name', { params: { name, excludeId } }), availableContract);
}

const date = (value?: string) => value ? dayjs(value).format('YYYY-MM-DD') : null;
const payload = (values: TaskFormValues) => ({ name: values.name, description: values.description || null, source_type: values.sourceType, project_id: values.sourceType === 1 ? Number(values.projectId) : null, requirement_id: values.sourceType === 2 ? Number(values.requirementId) : null, owner_id: Number(values.ownerId), task_type: Number(values.taskType), priority: Number(values.priority), start_date: date(values.startTime), expected_end_date: date(values.expectedEndTime) });

export async function createTask(values: TaskFormValues) {
  return unwrap<{ id: number }>(request.post('/tasks', payload(values)), objectContract(['id']));
}

const subtaskPayload = (values: TaskFormValues) => ({ name: values.name, description: values.description || null, owner_id: Number(values.ownerId), task_type: Number(values.taskType), priority: Number(values.priority), start_date: date(values.startTime), expected_end_date: date(values.expectedEndTime) });

export async function createSubtask(parentId: string, values: TaskFormValues) {
  return unwrap<{ id: number }>(request.post(`/tasks/${parentId}/subtasks`, subtaskPayload(values)), objectContract(['id']));
}

export async function getSubtasks(parentId: string) {
  const rows = await unwrap<Row[]>(request.get(`/tasks/${parentId}/subtasks`), arrayContract(rowContract));
  return rows.map(mapTask);
}

export async function updateTask(id: string, values: TaskFormValues) {
  return unwrap<null>(request.put(`/tasks/${id}`, payload(values)));
}

export async function batchAssignTasks(ids: string[], ownerId: string) {
  return unwrap<{ updated: number; requested: number }>(request.put('/tasks/batch-assign', { ids: ids.map(Number), owner_id: Number(ownerId) }), batchResultContract);
}

export async function updateTaskStatus(id: string, status: TaskStatus, extra = {}) {
  const result = await unwrap<{ allSubtasksCompleted: boolean; parentTaskId: number | null }>(request.put(`/tasks/${id}/status`, { status, ...extra }), statusResultContract);
  return { allSubtasksCompleted: result.allSubtasksCompleted, parentTaskId: result.parentTaskId ? String(result.parentTaskId) : '' } as TaskStatusUpdateResult;
}

export async function deleteTask(id: string) {
  return unwrap<null>(request.delete(`/tasks/${id}`));
}

export async function getTaskHistory(id: string) {
  return unwrap<any[]>(request.get(`/tasks/${id}/history`), arrayContract(objectContract(['id', 'action', 'created_at', 'operator', 'changes'])));
}
