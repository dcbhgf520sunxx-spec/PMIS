import dayjs from 'dayjs';
import { request, unwrap } from './requestClient';
import { arrayContract, objectContract } from './responseContract';
import type { BugFormValues, BugRecord, BugSeverity, BugStatus } from '../modules/bug/types';

type Row = { id: number; title: string; description?: string; source_type: 1 | 2; project_id?: number; project_name?: string; requirement_id?: number; requirement_name?: string; bug_type_id: number; bug_type_name: string; severity: number; status: number; assignee_id: number; assignee_name: string; resolution_id?: number; resolution_name?: string; resolved_date?: string; closed_date?: string; activation_reason?: string; creator_name?: string; updater_name?: string; created_at?: string; updated_at?: string };
type Page = { list: Row[]; total: number; page: number; pageSize: number; viewCounts: { all: number; mine: number } };

const rowContract = objectContract<Row>(['id', 'title', 'source_type', 'bug_type_id', 'bug_type_name', 'severity', 'status', 'assignee_id', 'assignee_name']);
const pageContract = objectContract<Page>(['list', 'total', 'page', 'pageSize', 'viewCounts'], { list: arrayContract(rowContract) });
const neighborsContract = objectContract<{ prevId: number | null; nextId: number | null; ordinal?: number; total?: number }>(['prevId', 'nextId']);
const projectOptionContract = objectContract<{ id: number; name: string }>(['id', 'name']);
const requirementOptionContract = objectContract<{ id: number; title: string }>(['id', 'title']);
const availableContract = objectContract<{ available: boolean }>(['available']);
const batchResultContract = objectContract<{ updated: number; requested: number }>(['updated', 'requested']);
const dateText = (value?: string) => String(value || '').slice(0, 10);
const dateTimeText = (value?: string) => String(value || '').slice(0, 19).replace('T', ' ');

function mapBug(row: Row): BugRecord {
  return {
    id: String(row.id), title: row.title, description: row.description || '', sourceType: row.source_type,
    projectId: row.project_id ? String(row.project_id) : '', projectName: row.project_name || '-',
    requirementId: row.requirement_id ? String(row.requirement_id) : '', requirementName: row.requirement_name || '-',
    bugTypeId: String(row.bug_type_id), bugTypeName: row.bug_type_name, severity: Number(row.severity) as BugSeverity,
    status: Number(row.status) as BugStatus, assigneeId: String(row.assignee_id), assigneeName: row.assignee_name,
    resolutionId: row.resolution_id ? String(row.resolution_id) : '', resolutionName: row.resolution_name || '-',
    resolvedTime: dateText(row.resolved_date), closedTime: dateText(row.closed_date), activationReason: row.activation_reason || '', creatorName: row.creator_name || '-',
    updaterName: row.updater_name || '-', createdAt: dateTimeText(row.created_at), updatedAt: dateTimeText(row.updated_at)
  };
}

export async function getBugList(params: Record<string, unknown> = {}) {
  const result = await unwrap<Page>(request.get('/bugs', { params }), pageContract);
  return { ...result, list: result.list.map(mapBug) };
}

export async function getBug(id: string) { return mapBug(await unwrap<Row>(request.get(`/bugs/${id}`), rowContract)); }

export async function getBugNeighbors(id: string, params: Record<string, unknown> = {}) {
  const result = await unwrap<{ prevId: number | null; nextId: number | null; ordinal?: number; total?: number }>(request.get('/bugs/neighbors', { params: { ...params, id } }), neighborsContract);
  return { prevId: result.prevId === null ? null : String(result.prevId), nextId: result.nextId === null ? null : String(result.nextId), ordinal: result.ordinal, total: result.total };
}

export async function getBugProjectOptions() {
  const rows = await unwrap<Array<{ id: number; name: string }>>(request.get('/bugs/project-options'), arrayContract(projectOptionContract));
  return rows.map((row) => ({ label: row.name, value: String(row.id) }));
}

export async function getBugRequirementOptions() {
  const rows = await unwrap<Array<{ id: number; title: string }>>(request.get('/bugs/requirement-options'), arrayContract(requirementOptionContract));
  return rows.map((row) => ({ label: row.title, value: String(row.id) }));
}

export async function checkBugTitle(title: string, excludeId?: string) { return unwrap<{ available: boolean }>(request.get('/bugs/check-title', { params: { title, excludeId } }), availableContract); }
const payload = (values: BugFormValues) => ({ title: values.title, description: values.description || null, source_type: values.sourceType, project_id: values.sourceType === 1 ? Number(values.projectId) : null, requirement_id: values.sourceType === 2 ? Number(values.requirementId) : null, bug_type_id: Number(values.bugTypeId), severity: Number(values.severity), assignee_id: Number(values.assigneeId) });
export async function createBug(values: BugFormValues) { return unwrap<{ id: number }>(request.post('/bugs', payload(values)), objectContract(['id'])); }
export async function updateBug(id: string, values: BugFormValues) { return unwrap<null>(request.put(`/bugs/${id}`, payload(values))); }
export async function batchAssignBugs(ids: string[], assigneeId: string) { return unwrap<{ updated: number; requested: number }>(request.put('/bugs/batch-assign', { ids: ids.map(Number), assignee_id: Number(assigneeId) }), batchResultContract); }
export async function updateBugStatus(id: string, status: BugStatus, extra: { resolvedTime?: string; closedTime?: string; resolutionId?: string; activationReason?: string } = {}) { return unwrap<null>(request.put(`/bugs/${id}/status`, { status, resolved_date: extra.resolvedTime ? dayjs(extra.resolvedTime).format('YYYY-MM-DD') : undefined, closed_date: extra.closedTime ? dayjs(extra.closedTime).format('YYYY-MM-DD') : undefined, resolution_id: extra.resolutionId ? Number(extra.resolutionId) : undefined, activation_reason: extra.activationReason?.trim() || undefined })); }
export async function deleteBug(id: string) { return unwrap<null>(request.delete(`/bugs/${id}`)); }
export async function getBugHistory(id: string) { return unwrap<any[]>(request.get(`/bugs/${id}/history`), arrayContract(objectContract(['id', 'action', 'created_at', 'operator', 'changes']))); }
