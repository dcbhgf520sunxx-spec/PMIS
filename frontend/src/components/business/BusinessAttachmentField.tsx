import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  AdminAttachmentUpload,
  AdminFormItem,
  type AdminAttachment,
} from '../admin';
import {
  deleteBusinessAttachment,
  downloadBusinessAttachment,
  getBusinessAttachments,
  loadBusinessAttachment,
  uploadBusinessAttachment,
  type BusinessAttachmentRecord,
} from '../../api/businessAttachmentApi';
import {
  COMMON_ATTACHMENT_ACCEPT,
  COMMON_ATTACHMENT_MAX_SIZE,
  COMMON_ATTACHMENT_TYPE_HINT,
} from './businessAttachmentRules';

const pendingPrefix = 'pending-';

function toAdminAttachment(attachment: BusinessAttachmentRecord): AdminAttachment {
  return {
    id: attachment.id,
    name: attachment.originalName,
    size: attachment.fileSize,
    contentType: attachment.mimeType,
    status: 'done',
  };
}

function isPending(attachment: AdminAttachment) {
  return attachment.id.startsWith(pendingPrefix);
}

function downloadLocal(attachment: AdminAttachment) {
  if (!attachment.rawFile) return;
  const url = URL.createObjectURL(attachment.rawFile);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = attachment.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export type BusinessAttachmentFieldHandle = {
  commit: (businessId: string) => Promise<void>;
};

type Props = {
  apiPath: string;
  businessId?: string;
  readOnly?: boolean;
  label?: string;
};

export const BusinessAttachmentField = forwardRef<BusinessAttachmentFieldHandle, Props>(function BusinessAttachmentField({
  apiPath,
  businessId,
  readOnly = false,
  label = '附件',
}, ref) {
  const [attachments, setAttachments] = useState<AdminAttachment[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setAttachments([]);
    setRemovedIds([]);
    if (!businessId) return () => { cancelled = true; };
    getBusinessAttachments(apiPath, businessId).then((rows) => {
      if (!cancelled) setAttachments(rows.map(toAdminAttachment));
    });
    return () => { cancelled = true; };
  }, [apiPath, businessId]);

  useImperativeHandle(ref, () => ({
    commit: async (targetId: string) => {
      for (const attachmentId of removedIds) {
        await deleteBusinessAttachment(apiPath, targetId, attachmentId);
      }
      const uploaded: AdminAttachment[] = [];
      for (const attachment of attachments) {
        if (!isPending(attachment)) {
          if (!removedIds.includes(attachment.id)) uploaded.push(attachment);
          continue;
        }
        if (!attachment.rawFile) continue;
        uploaded.push(toAdminAttachment(await uploadBusinessAttachment(apiPath, targetId, attachment.rawFile)));
      }
      setAttachments(uploaded);
      setRemovedIds([]);
    },
  }), [apiPath, attachments, removedIds]);

  const loadPreview = (attachment: AdminAttachment) => {
    if (isPending(attachment)) return attachment.rawFile || Promise.reject(new Error('附件内容不存在'));
    if (!businessId) return Promise.reject(new Error('业务数据尚未保存'));
    return loadBusinessAttachment(apiPath, businessId, attachment.id);
  };
  const download = (attachment: AdminAttachment) => {
    if (isPending(attachment)) return downloadLocal(attachment);
    if (!businessId) return;
    return downloadBusinessAttachment(apiPath, businessId, attachment.id, attachment.name);
  };

  if (readOnly) return (
    <AdminAttachmentUpload
      readOnly
      accept={COMMON_ATTACHMENT_ACCEPT}
      multiple
      maxCount={10}
      maxSize={COMMON_ATTACHMENT_MAX_SIZE}
      value={attachments}
      onChange={setAttachments}
      onLoadPreview={loadPreview}
      onDownload={download}
    />
  );

  return (
    <AdminFormItem label={label} className="admin-template-form-page__field is-full">
      <AdminAttachmentUpload
        accept={COMMON_ATTACHMENT_ACCEPT}
        multiple
        maxCount={10}
        maxSize={COMMON_ATTACHMENT_MAX_SIZE}
        value={attachments}
        onChange={setAttachments}
        onUpload={async (file, { onProgress }) => {
          onProgress(100);
          return { id: `${pendingPrefix}${file.uid}`, name: file.name, size: file.size, contentType: file.type };
        }}
        onRemove={(attachment) => {
          if (!isPending(attachment)) setRemovedIds((current) => [...new Set([...current, attachment.id])]);
        }}
        onLoadPreview={loadPreview}
        onDownload={download}
        hint={`${COMMON_ATTACHMENT_TYPE_HINT}；单个文件不超过20MB，最多10个；随业务数据保存上传。`}
      />
    </AdminFormItem>
  );
});
