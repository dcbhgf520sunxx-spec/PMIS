import type { ProjectPlanItem, ProjectPlanItemForm } from './types';

export function requiresPendingDeliveryUpload(item: ProjectPlanItem, values: ProjectPlanItemForm) {
  return item.status === 2
    && !item.requiresDeliveryFile
    && values.requiresDeliveryFile
    && item.fileCount === 0;
}

type SaveProjectPlanItemEditOptions = {
  item: ProjectPlanItem;
  values: ProjectPlanItemForm;
  files: File[];
  upload: (file: File) => Promise<{ id: string }>;
  save: () => Promise<void>;
  remove: (fileId: string) => Promise<void>;
};

export async function saveProjectPlanItemEdit({
  item, values, files, upload, save, remove
}: SaveProjectPlanItemEditOptions) {
  if (requiresPendingDeliveryUpload(item, values) && files.length === 0) {
    throw new Error('请上传至少一个关键交付文件');
  }
  const uploadedIds: string[] = [];
  try {
    for (const file of files) {
      const uploaded = await upload(file);
      uploadedIds.push(uploaded.id);
    }
    await save();
  } catch (error) {
    await Promise.allSettled(uploadedIds.map((fileId) => remove(fileId)));
    throw error;
  }
}
