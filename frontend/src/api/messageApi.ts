import { request, unwrap } from './requestClient';

export type MessageType = 'notification' | 'system';

export type MessageRecord = {
  id: string;
  type: MessageType;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  href?: string;
};

type MessageResponse = {
  id: number;
  type: MessageType;
  title: string;
  description: string;
  link_path?: string;
  read_at?: string | null;
  created_at?: string;
};

function formatMessageTime(value?: string) {
  if (!value) return '-';

  const createdAt = new Date(value);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - createdAt.getTime()) / 60000);

  if (Number.isFinite(diffMinutes) && diffMinutes < 1) return '刚刚';
  if (Number.isFinite(diffMinutes) && diffMinutes < 60) return `${diffMinutes} 分钟前`;
  if (createdAt.toDateString() === now.toDateString()) {
    return `今天 ${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`;
  }

  return String(value).slice(0, 16).replace('T', ' ');
}

function toMessageRecord(row: MessageResponse): MessageRecord {
  return {
    id: String(row.id),
    type: row.type,
    title: row.title,
    description: row.description,
    time: formatMessageTime(row.created_at),
    unread: !row.read_at,
    href: row.link_path || undefined
  };
}

export async function getMessages() {
  const rows = await unwrap<MessageResponse[]>(request.get('/messages'));
  return rows.map(toMessageRecord);
}

export async function markMessageRead(id: string) {
  return unwrap<{ id: number }>(request.put(`/messages/${id}/read`));
}

export async function markAllMessagesRead() {
  return unwrap<{ updated: number }>(request.put('/messages/read-all'));
}
