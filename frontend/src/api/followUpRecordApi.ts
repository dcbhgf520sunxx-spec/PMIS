import { request, unwrap } from './requestClient';
import { arrayContract, objectContract } from './responseContract';

export type FollowUpTargetType = 'project' | 'requirement' | 'task';

export type FollowUpRecord = {
  id: string;
  content: string;
  creatorId: string;
  creatorName: string;
  updaterId: string;
  updaterName: string;
  createdAt: string;
  updatedAt: string;
};

type FollowUpRow = {
  id: number;
  content: string;
  'creator_id': number | null;
  creator_name: string | null;
  'updater_id': number | null;
  updater_name: string | null;
  created_at: string;
  updated_at: string;
};

const targetPaths: Record<FollowUpTargetType, string> = {
  project: 'projects',
  requirement: 'requirements',
  task: 'tasks',
};
const rowContract = objectContract<FollowUpRow>([
  'id', 'content', 'creator_id', 'creator_name', 'updater_id', 'updater_name', 'created_at', 'updated_at'
]);
const listContract = arrayContract(rowContract);
const idContract = objectContract<{ id: number }>(['id']);
const formatDateTime = (value: string) => String(value || '').slice(0, 19).replace('T', ' ');
const mapRow = (row: FollowUpRow): FollowUpRecord => ({
  id: String(row.id),
  content: row.content,
  creatorId: row.creator_id === null ? '' : String(row.creator_id),
  creatorName: row.creator_name || '-',
  updaterId: row.updater_id === null ? '' : String(row.updater_id),
  updaterName: row.updater_name || '-',
  createdAt: formatDateTime(row.created_at),
  updatedAt: formatDateTime(row.updated_at),
});
const basePath = (type: FollowUpTargetType, targetId: string) => `/${targetPaths[type]}/${targetId}/follow-ups`;

export async function getFollowUpRecords(type: FollowUpTargetType, targetId: string) {
  return (await unwrap<FollowUpRow[]>(request.get(basePath(type, targetId)), listContract)).map(mapRow);
}

export async function createFollowUpRecord(type: FollowUpTargetType, targetId: string, content: string) {
  return unwrap<{ id: number }>(request.post(basePath(type, targetId), { content }), idContract);
}

export async function updateFollowUpRecord(type: FollowUpTargetType, targetId: string, recordId: string, content: string) {
  return unwrap<null>(request.put(`${basePath(type, targetId)}/${recordId}`, { content }));
}

export async function deleteFollowUpRecord(type: FollowUpTargetType, targetId: string, recordId: string) {
  return unwrap<null>(request.delete(`${basePath(type, targetId)}/${recordId}`));
}
