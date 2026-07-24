import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AudioOutlined,
  CloseCircleFilled,
  CloudUploadOutlined,
  DownloadOutlined,
  ExportOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  FilePptOutlined,
  FileWordOutlined,
  FileZipOutlined,
  LoadingOutlined,
  RedoOutlined,
  VideoCameraOutlined
} from '@ant-design/icons';
import { Progress, Upload } from 'antd';
import type { RcFile } from 'antd/es/upload/interface';
import { AdminDeleteIconAction, AdminIconAction } from '../AdminIconAction';
import { AdminModal } from '../AdminModal';
import { AdminButton } from '../AdminPrimitives';
import { useAdminFeedback } from '../AdminFeedback';
import {
  ADMIN_ATTACHMENT_IMAGE_FORMATS,
  formatAttachmentSize,
  validateAttachmentFile
} from './validation';
import './index.css';

export type AdminAttachmentStatus = 'uploading' | 'done' | 'error';

export type AdminAttachment = {
  id: string;
  name: string;
  size?: number;
  status: AdminAttachmentStatus;
  percent?: number;
  url?: string;
  contentType?: string;
  errorMessage?: string;
  rawFile?: RcFile;
};

export type AdminAttachmentUploadResult = {
  id: string;
  name?: string;
  size?: number;
  url?: string;
  contentType?: string;
};

export type AdminAttachmentUploadContext = {
  onProgress: (percent: number) => void;
};

type AttachmentPreviewLoader = (attachment: AdminAttachment) => Promise<Blob> | Blob;
type AttachmentDownloadHandler = (attachment: AdminAttachment) => Promise<void> | void;

type AdminAttachmentAccessProps = {
  onLoadPreview?: never;
  onDownload?: never;
} | {
  onLoadPreview: AttachmentPreviewLoader;
  onDownload: AttachmentDownloadHandler;
};

type AdminAttachmentModeProps = {
  readOnly: true;
  onUpload?: never;
} | {
  readOnly?: false;
  onUpload: (file: RcFile, context: AdminAttachmentUploadContext) => Promise<AdminAttachmentUploadResult>;
};

export type AdminAttachmentUploadProps = {
  value?: AdminAttachment[];
  defaultValue?: AdminAttachment[];
  onChange?: (attachments: AdminAttachment[]) => void;
  onRemove?: (attachment: AdminAttachment) => Promise<void> | void;
  accept?: string;
  maxCount?: number;
  maxSize?: number;
  multiple?: boolean;
  disabled?: boolean;
  hint?: ReactNode;
} & AdminAttachmentAccessProps & AdminAttachmentModeProps;

function errorMessageOf(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

type AttachmentUploadVariant = 'button' | 'dragger';
const DEFAULT_UPLOAD_HINT = `可选择一个或多个文件；图片支持 ${ADMIN_ATTACHMENT_IMAGE_FORMATS.join('、')}`;

function attachmentKind(attachment: AdminAttachment) {
  const name = attachment.name.toLowerCase();
  const type = (attachment.contentType || attachment.rawFile?.type || '').toLowerCase();
  if (type.startsWith('image/') || /\.(avif|bmp|gif|heic|jpe?g|png|svg|webp)$/.test(name)) return 'image';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (type.includes('word') || /\.(doc|docx)$/.test(name)) return 'word';
  if (type.includes('excel') || type.includes('spreadsheet') || /\.(csv|xls|xlsx)$/.test(name)) return 'excel';
  if (type.includes('powerpoint') || type.includes('presentation') || /\.(ppt|pptx)$/.test(name)) return 'ppt';
  if (type.startsWith('audio/') || /\.(aac|flac|m4a|mp3|ogg|wav)$/.test(name)) return 'audio';
  if (type.startsWith('video/') || /\.(avi|m4v|mkv|mov|mp4|webm)$/.test(name)) return 'video';
  if (type.includes('zip') || type.includes('compressed') || /\.(7z|gz|rar|tar|zip)$/.test(name)) return 'archive';
  return 'file';
}

function attachmentIcon(attachment: AdminAttachment) {
  const kind = attachmentKind(attachment);
  if (kind === 'image') return <FileImageOutlined />;
  if (kind === 'pdf') return <FilePdfOutlined />;
  if (kind === 'word') return <FileWordOutlined />;
  if (kind === 'excel') return <FileExcelOutlined />;
  if (kind === 'ppt') return <FilePptOutlined />;
  if (kind === 'audio') return <AudioOutlined />;
  if (kind === 'video') return <VideoCameraOutlined />;
  if (kind === 'archive') return <FileZipOutlined />;
  return <FileOutlined />;
}

function isAttachmentPreviewable(attachment: AdminAttachment) {
  const kind = attachmentKind(attachment);
  return kind === 'image' || kind === 'pdf';
}

function attachmentPreviewMimeType(attachment: AdminAttachment) {
  if (attachmentKind(attachment) === 'pdf') return 'application/pdf';
  const declaredType = (attachment.contentType || attachment.rawFile?.type || '').toLowerCase();
  if (declaredType.startsWith('image/')) return declaredType;
  const extension = attachment.name.toLowerCase().split('.').pop();
  const imageTypeMap: Record<string, string> = {
    avif: 'image/avif', bmp: 'image/bmp', gif: 'image/gif', heic: 'image/heic',
    jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', webp: 'image/webp'
  };
  return imageTypeMap[extension || ''] || 'image/*';
}

type AttachmentPreviewState = {
  kind: 'image' | 'pdf';
  name: string;
  url: string;
};

function AttachmentUpload({
  variant,
  value,
  defaultValue = [],
  onChange,
  onUpload,
  onLoadPreview,
  onDownload,
  onRemove,
  accept,
  maxCount,
  maxSize,
  multiple = true,
  disabled,
  readOnly = false,
  hint
}: AdminAttachmentUploadProps & { variant: AttachmentUploadVariant }) {
  const { message } = useAdminFeedback();
  const [innerValue, setInnerValue] = useState(defaultValue);
  const [preview, setPreview] = useState<AttachmentPreviewState>();
  const attachments = value ?? innerValue;
  const attachmentsRef = useRef(attachments);
  const previewUrlRef = useRef('');

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const commit = (next: AdminAttachment[]) => {
    attachmentsRef.current = next;
    if (value === undefined) setInnerValue(next);
    onChange?.(next);
  };

  const updateAttachment = (id: string, updater: (attachment: AdminAttachment) => AdminAttachment) => {
    commit(attachmentsRef.current.map((attachment) => (
      attachment.id === id ? updater(attachment) : attachment
    )));
  };

  const uploadFile = async (file: RcFile, existingId?: string) => {
    if (!onUpload || readOnly) return;
    const validationError = validateAttachmentFile(file, { accept, maxSize });
    if (validationError) {
      message.error(`${file.name}：${validationError}`);
      return;
    }

    const capacity = multiple ? maxCount : 1;
    if (!existingId && capacity !== undefined && attachmentsRef.current.length >= capacity) {
      message.error(`最多上传 ${capacity} 个附件`);
      return;
    }

    const temporaryId = existingId || `upload-${file.uid}`;
    const uploading: AdminAttachment = {
      id: temporaryId,
      name: file.name,
      size: file.size,
      status: 'uploading',
      percent: 0,
      rawFile: file
    };

    if (existingId) {
      updateAttachment(existingId, () => uploading);
    } else {
      commit([...attachmentsRef.current, uploading]);
    }

    try {
      const result = await onUpload(file, {
        onProgress: (percent) => {
          const normalized = Math.max(0, Math.min(100, Math.round(percent)));
          updateAttachment(temporaryId, (attachment) => ({ ...attachment, percent: normalized }));
        }
      });
      updateAttachment(temporaryId, (attachment) => ({
        ...attachment,
        ...result,
        id: result.id,
        name: result.name || file.name,
        size: result.size ?? file.size,
        status: 'done',
        percent: 100,
        errorMessage: undefined
      }));
    } catch (error) {
      updateAttachment(temporaryId, (attachment) => ({
        ...attachment,
        status: 'error',
        errorMessage: errorMessageOf(error, '上传失败，请重试')
      }));
    }
  };

  const handleRetry = (attachment: AdminAttachment) => {
    if (attachment.rawFile) void uploadFile(attachment.rawFile, attachment.id);
  };

  const handleDownload = async (attachment: AdminAttachment) => {
    if (!onDownload) return;
    try {
      await onDownload(attachment);
    } catch (error) {
      message.error(errorMessageOf(error, '下载失败，请稍后重试'));
    }
  };

  const handlePreview = async (attachment: AdminAttachment) => {
    if (!onLoadPreview) return;
    if (!isAttachmentPreviewable(attachment)) {
      message.warning('该格式暂不支持在线预览，请下载查看');
      return;
    }
    try {
      const source = await onLoadPreview(attachment);
      if (!(source instanceof Blob)) throw new Error('预览接口未返回有效文件内容');
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const previewBlob = new Blob([source], { type: attachmentPreviewMimeType(attachment) });
      const url = URL.createObjectURL(previewBlob);
      const kind = attachmentKind(attachment) as AttachmentPreviewState['kind'];
      previewUrlRef.current = url;
      setPreview({ kind, name: attachment.name, url });
    } catch (error) {
      message.error(errorMessageOf(error, '预览失败，请稍后重试'));
    }
  };

  const closePreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
    setPreview(undefined);
  };

  const handleRemove = async (attachment: AdminAttachment) => {
    if (onRemove) await onRemove(attachment);
    commit(attachmentsRef.current.filter((item) => item.id !== attachment.id));
  };

  const uploadHint = hint || DEFAULT_UPLOAD_HINT;
  const beforeUpload = (file: RcFile) => {
    void uploadFile(file);
    return Upload.LIST_IGNORE;
  };

  return (
    <div className="admin-attachment-upload">
      {!readOnly ? (variant === 'dragger' ? (
        <Upload.Dragger
          accept={accept}
          beforeUpload={beforeUpload}
          disabled={disabled}
          multiple={multiple}
          openFileDialogOnClick={!disabled}
          showUploadList={false}
        >
          <div className="admin-attachment-upload__drop-content">
            <CloudUploadOutlined />
            <strong>{disabled ? '附件上传已禁用' : '拖拽文件到此处，或点击选择文件'}</strong>
            <span>{uploadHint}</span>
          </div>
        </Upload.Dragger>
      ) : (
        <div className="admin-attachment-upload__button-entry">
          <Upload
            accept={accept}
            beforeUpload={beforeUpload}
            disabled={disabled}
            multiple={multiple}
            showUploadList={false}
          >
            <AdminButton disabled={disabled} icon={<CloudUploadOutlined />}>选择文件</AdminButton>
          </Upload>
          <span>{uploadHint}</span>
        </div>
      )) : null}

      {attachments.length ? (
        <ul className="admin-attachment-upload__list" aria-label="附件列表">
          {attachments.map((attachment) => (
            <li className={`admin-attachment-upload__item is-${attachment.status}`} key={attachment.id}>
              <span className={`admin-attachment-upload__file-icon is-${attachmentKind(attachment)}`}>
                {attachmentIcon(attachment)}
              </span>
              <div className="admin-attachment-upload__file-main">
                {attachment.status === 'done' && onLoadPreview ? (
                  <button
                    className="admin-attachment-upload__file-name is-previewable"
                    title={`预览 ${attachment.name}`}
                    type="button"
                    onClick={() => void handlePreview(attachment)}
                  >
                    {attachment.name}
                  </button>
                ) : (
                  <strong className="admin-attachment-upload__file-name" title={attachment.name}>
                    {attachment.name}
                  </strong>
                )}
                {attachment.status !== 'done' ? (
                  <div className="admin-attachment-upload__meta">
                    <span>{formatAttachmentSize(attachment.size)}</span>
                    <span className="admin-attachment-upload__status">
                    {attachment.status === 'uploading' ? <LoadingOutlined spin /> : null}
                    {attachment.status === 'error' ? <CloseCircleFilled /> : null}
                    <span>{attachment.status === 'uploading' ? '上传中' : attachment.errorMessage || '上传失败'}</span>
                    </span>
                  </div>
                ) : null}
                {attachment.status === 'uploading' ? (
                  <Progress percent={attachment.percent || 0} showInfo={false} size="small" />
                ) : null}
              </div>
              {attachment.status === 'done' ? (
                <span className="admin-attachment-upload__size">
                  {formatAttachmentSize(attachment.size)}
                </span>
              ) : null}
              <div className="admin-attachment-upload__actions">
                {!readOnly && attachment.status === 'error' && attachment.rawFile ? (
                  <AdminIconAction
                    icon={<RedoOutlined />}
                    label="重试"
                    onClick={() => handleRetry(attachment)}
                  />
                ) : null}
                {attachment.status === 'done' && onDownload ? (
                  <AdminIconAction
                    icon={<DownloadOutlined />}
                    label="下载"
                    onClick={() => void handleDownload(attachment)}
                  />
                ) : null}
                {!readOnly && !disabled && (onRemove || attachment.status !== 'done') ? (
                  <AdminDeleteIconAction
                    entityName="附件"
                    targetName={attachment.name}
                    successMessage="附件已删除"
                    onConfirm={() => handleRemove(attachment)}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <AdminModal
        className="admin-attachment-upload__preview-modal"
        title={(
          <div className="admin-attachment-upload__preview-title">
            <span title={preview?.name}>
              {preview ? `附件预览：${preview.name}` : '附件预览'}
            </span>
            {preview ? (
              <AdminIconAction
                className="admin-attachment-upload__open-window"
                label="新窗口打开"
                icon={<ExportOutlined />}
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
              />
            ) : null}
          </div>
        )}
        open={Boolean(preview)}
        width={920}
        footer={null}
        onCancel={closePreview}
      >
        {preview ? (
          <div className={`admin-attachment-upload__preview is-${preview.kind}`}>
            {preview.kind === 'image' ? (
              <img src={preview.url} alt={preview.name} />
            ) : (
              <iframe src={preview.url} title={preview.name} />
            )}
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
}

export function AdminAttachmentUpload(props: AdminAttachmentUploadProps) {
  return <AttachmentUpload {...props} variant="button" />;
}

export function AdminAttachmentDragger(props: AdminAttachmentUploadProps) {
  return <AttachmentUpload {...props} variant="dragger" />;
}

export {
  ADMIN_ATTACHMENT_IMAGE_FORMATS,
  formatAttachmentSize,
  matchesAttachmentAccept,
  validateAttachmentFile
} from './validation';
