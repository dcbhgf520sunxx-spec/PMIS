import { request, unwrap } from './requestClient';
import { arrayContract, objectContract } from './responseContract';

type BusinessAttachmentRow = {
  id: number;
  original_name: string;
  mime_type: string;
  file_size: number;
};

export type BusinessAttachmentRecord = {
  id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
};

const rowContract = objectContract<BusinessAttachmentRow>(['id', 'original_name', 'mime_type', 'file_size']);
const mapAttachment = (row: BusinessAttachmentRow): BusinessAttachmentRecord => ({
  id: String(row.id),
  originalName: row.original_name,
  mimeType: row.mime_type,
  fileSize: Number(row.file_size),
});

export async function getBusinessAttachments(path: string, businessId: string) {
  const rows = await unwrap<BusinessAttachmentRow[]>(request.get(`${path}/${businessId}/attachments`), arrayContract(rowContract));
  return rows.map(mapAttachment);
}

export async function uploadBusinessAttachment(path: string, businessId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const row = await unwrap<BusinessAttachmentRow>(request.post(`${path}/${businessId}/attachments`, form), rowContract);
  return mapAttachment(row);
}

export async function deleteBusinessAttachment(path: string, businessId: string, attachmentId: string) {
  return unwrap<null>(request.delete(`${path}/${businessId}/attachments/${attachmentId}`));
}

export async function loadBusinessAttachment(path: string, businessId: string, attachmentId: string) {
  const response = await request.get<Blob>(`${path}/${businessId}/attachments/${attachmentId}/download`, { responseType: 'blob' });
  return response.data;
}

export async function downloadBusinessAttachment(path: string, businessId: string, attachmentId: string, fileName: string) {
  const url = URL.createObjectURL(await loadBusinessAttachment(path, businessId, attachmentId));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
