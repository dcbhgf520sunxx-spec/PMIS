import { useState } from 'react';
import type { RcFile } from 'antd/es/upload/interface';
import {
  AdminAttachmentDragger, AdminAttachmentUpload, AdminCard, AdminColorPicker,
  RichDescriptionEditor, useAdminFeedback, type AdminAttachment, type AdminAttachmentUploadProps
} from '../../../../../components/admin';
import { ComponentEntry } from '../../components/ComponentEntry';

type AdvancedInputExamplesProps = {
  richText: string;
  setRichText: (value: string) => void;
};

function createPreviewDemoPdf() {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 260] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n',
    '4 0 obj\n<< /Length 58 >>\nstream\nBT /F1 20 Tf 72 160 Td (Attachment preview works) Tj ET\nendstream\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += object;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function AdvancedInputExamples({ richText, setRichText }: AdvancedInputExamplesProps) {
  const { message } = useAdminFeedback();
  const [attachments, setAttachments] = useState<AdminAttachment[]>([
    { id: 'preview-image', name: '预览示例.png', size: 18_432, status: 'done', contentType: 'image/png' },
    { id: 'preview-pdf', name: '预览示例.pdf', size: 832_104, status: 'done', contentType: 'application/pdf' },
    { id: 'unsupported-word', name: '暂不支持预览.docx', size: 126_420, status: 'done' }
  ]);
  const [dragAttachments, setDragAttachments] = useState<AdminAttachment[]>(() => {
    const failedFile = Object.assign(
      new File(['失败重试示例'], '模拟上传失败.txt', { type: 'text/plain' }),
      { uid: 'demo-upload-error' }
    ) as RcFile;
    return [
      {
        id: 'demo-upload-error',
        name: failedFile.name,
        size: failedFile.size,
        status: 'error',
        errorMessage: '网络中断，请重试',
        rawFile: failedFile
      }
    ];
  });

  const simulateUpload: AdminAttachmentUploadProps['onUpload'] = async (file, { onProgress }) => {
    for (const percent of [30, 65, 100]) {
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      onProgress(percent);
    }
    return {
      id: `demo-${Date.now()}-${file.uid}`,
      name: file.name,
      size: file.size
    };
  };

  const loadPreview: NonNullable<AdminAttachmentUploadProps['onLoadPreview']> = async (attachment) => {
    if (attachment.id === 'preview-image') {
      const response = await fetch('/sidebar-logo.png');
      if (!response.ok) throw new Error('示例图片加载失败');
      return response.blob();
    }
    return createPreviewDemoPdf();
  };

  return (
    <>
      <AdminCard title="9. 上传">
        <div className="design-system-page__input-grid">
          <section className="design-system-page__input-panel is-wide">
            <div className="design-system-page__input-panel-head">
              <h3>上传</h3>
              <p>用于附件、截图、导入文件，上传入口要清晰，限制条件写在提示里。</p>
            </div>
            <div className="design-system-page__input-demo-list design-system-page__input-demo-list--stack">
              <div className="design-system-page__input-demo">
                <h4>基础上传</h4>
                <ComponentEntry name="AdminAttachmentUpload" />
                <p className="design-system-page__input-demo-description">
                  按钮选择文件；已有附件和新附件统一展示，点击名称预览，图标操作用于下载和删除。
                </p>
                <AdminAttachmentUpload
                  value={attachments}
                  onChange={setAttachments}
                  onUpload={simulateUpload}
                  onDownload={(attachment) => {
                    message.success(`开始下载：${attachment.name}`);
                  }}
                  onLoadPreview={loadPreview}
                  onRemove={async () => {
                    await new Promise((resolve) => window.setTimeout(resolve, 180));
                  }}
                />
              </div>
              <div className="design-system-page__input-demo is-wide">
                <h4>拖拽上传</h4>
                <ComponentEntry name="AdminAttachmentDragger" />
                <p className="design-system-page__input-demo-description">
                  拖拽或点击选择文件；上传完成后不重复显示成功文案，失败时保留原因和重试入口。
                </p>
                <AdminAttachmentDragger
                  value={dragAttachments}
                  onChange={setDragAttachments}
                  onUpload={simulateUpload}
                  onLoadPreview={loadPreview}
                  onDownload={(attachment) => {
                    message.success(`开始下载：${attachment.name}`);
                  }}
                  onRemove={async () => undefined}
                />
              </div>
              <div className="design-system-page__input-demo">
                <h4>只读附件</h4>
                <ComponentEntry name="AdminAttachmentUpload" />
                <AdminAttachmentUpload
                  readOnly
                  value={attachments}
                  onLoadPreview={loadPreview}
                  onDownload={(attachment) => {
                    message.success(`开始下载：${attachment.name}`);
                  }}
                />
              </div>
            </div>
          </section>
        </div>
      </AdminCard>

      <AdminCard title="10. 颜色选择器">
        <div className="design-system-page__input-grid">
          <section className="design-system-page__input-panel">
            <div className="design-system-page__input-panel-head">
              <h3>颜色选择器</h3>
              <p>只用于需要人工配置色值的场景，默认色要和主题变量保持一致。</p>
            </div>
            <div className="design-system-page__input-demo-list">
              <div className="design-system-page__input-demo">
                <h4>基础颜色</h4>
                <ComponentEntry name="AdminColorPicker" />
                <AdminColorPicker className="design-system-page__color-picker" defaultValue="var(--app-primary-hover)" />
              </div>
              <div className="design-system-page__input-demo">
                <h4>预设颜色</h4>
                <ComponentEntry name="AdminColorPicker" />
                <AdminColorPicker
                  className="design-system-page__color-picker"
                  defaultValue="#0f42d2"
                  presets={[
                    {
                      label: '主题色',
                      colors: ['var(--app-primary-hover)', '#0f42d2', 'var(--app-cyan-deep)', 'var(--app-steel)']
                    }
                  ]}
                />
              </div>
            </div>
          </section>
        </div>
      </AdminCard>

      <AdminCard title="11. 富文本编辑器">
        <div className="design-system-page__input-grid">
          <section className="design-system-page__input-panel is-wide">
            <div className="design-system-page__input-panel-head">
              <h3>富文本编辑器</h3>
              <ComponentEntry name="RichDescriptionEditor" />
              <p>适合问题描述、处理记录，支持粘贴图片并调整图片大小。</p>
            </div>
            <RichDescriptionEditor value={richText} onChange={setRichText} />
          </section>
        </div>
      </AdminCard>
    </>
  );
}
