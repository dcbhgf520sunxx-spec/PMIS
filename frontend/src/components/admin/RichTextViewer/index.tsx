import { useState } from 'react';
import { sanitizeRichText } from '../../../utils/richText';
import { AdminModal } from '../AdminModal';
import './index.css';

type RichTextViewerProps = {
  value?: string;
  emptyText?: string;
};

export function RichTextViewer({ value, emptyText = '-' }: RichTextViewerProps) {
  const safeHtml = sanitizeRichText(value || '');
  const [previewSrc, setPreviewSrc] = useState('');

  if (!safeHtml) {
    return <div className="admin-rich-text-viewer admin-rich-text-viewer--empty">{emptyText}</div>;
  }

  return (
    <>
      <div
        className="admin-rich-text-viewer"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
        onClick={(event) => {
          const image = (event.target as HTMLElement).closest('img') as HTMLImageElement | null;
          if (image?.src) {
            setPreviewSrc(image.src);
          }
        }}
      />
      <AdminModal
        className="admin-rich-text-viewer__preview-modal"
        title="图片预览"
        open={Boolean(previewSrc)}
        width={920}
        footer={null}
        onCancel={() => setPreviewSrc('')}
      >
        <div className="admin-rich-text-viewer__preview">
          <img src={previewSrc} alt="图片预览" />
        </div>
      </AdminModal>
    </>
  );
}
