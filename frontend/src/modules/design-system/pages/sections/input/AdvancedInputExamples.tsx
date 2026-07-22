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

export function AdvancedInputExamples({ richText, setRichText }: AdvancedInputExamplesProps) {
  const { message } = useAdminFeedback();
  const [attachments, setAttachments] = useState<AdminAttachment[]>([
    { id: 'existing-contract', name: '已有附件-合同扫描件.pdf', size: 832_104, status: 'done' },
    { id: 'existing-image', name: '现场照片.png', size: 1_240_072, status: 'done' },
    { id: 'existing-sheet', name: '费用明细.xlsx', size: 126_420, status: 'done' }
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
                  onPreview={(attachment) => {
                    message.success(`预览：${attachment.name}`);
                  }}
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
                  onPreview={(attachment) => {
                    message.success(`预览：${attachment.name}`);
                  }}
                  onDownload={(attachment) => {
                    message.success(`开始下载：${attachment.name}`);
                  }}
                  onRemove={async () => undefined}
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
