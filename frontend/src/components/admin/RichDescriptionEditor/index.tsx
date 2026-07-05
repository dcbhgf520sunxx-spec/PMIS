import { useEffect, useRef, useState } from 'react';
import { Button, message, Space, Tooltip } from 'antd';
import { BoldOutlined, ItalicOutlined, OrderedListOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { sanitizeRichText } from '../../../utils/richText';
import './index.css';

type RichDescriptionEditorProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  tip?: string;
};

export function RichDescriptionEditor({
  value = '',
  onChange,
  placeholder = '请输入描述，可粘贴图片',
  tip = '支持基础格式和粘贴图片，图片建议小于 5MB。'
}: RichDescriptionEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef('');
  const selectedImageRef = useRef<HTMLImageElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<{ left: number; top: number; visible: boolean }>({
    left: 0,
    top: 0,
    visible: false
  });

  const updateResizeHandle = () => {
    const body = editorRef.current?.parentElement;
    const image = selectedImageRef.current;
    if (!body || !image || !body.contains(image)) {
      setResizeHandle((prev) => ({ ...prev, visible: false }));
      return;
    }

    const bodyRect = body.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    setResizeHandle({
      left: imageRect.right - bodyRect.left - 6,
      top: imageRect.bottom - bodyRect.top - 6,
      visible: true
    });
  };

  useEffect(() => {
    const editor = editorRef.current;
    const safeValue = sanitizeRichText(value);
    if (editor && safeValue !== lastValueRef.current && safeValue !== editor.innerHTML) {
      editor.innerHTML = safeValue;
      lastValueRef.current = safeValue;
    }
  }, [value]);

  useEffect(() => {
    window.addEventListener('resize', updateResizeHandle);
    return () => window.removeEventListener('resize', updateResizeHandle);
  }, []);

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const safeValue = sanitizeRichText(editor.innerHTML);
    lastValueRef.current = safeValue;
    onChange?.(safeValue);
  };

  const exec = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command);
    emitChange();
  };

  const insertImage = (src: string) => {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, `<img src="${src}" alt="图片" />`);
    emitChange();
  };

  const selectImage = (image: HTMLImageElement | null) => {
    selectedImageRef.current?.classList.remove('is-selected');
    selectedImageRef.current = image;
    image?.classList.add('is-selected');
    updateResizeHandle();
  };

  const handleEditorClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    const target = event.target as HTMLElement;
    selectImage(target.tagName === 'IMG' ? target as HTMLImageElement : null);
  };

  const handleResizeStart: React.MouseEventHandler<HTMLSpanElement> = (event) => {
    const image = selectedImageRef.current;
    const body = editorRef.current?.parentElement;
    if (!image || !body) return;

    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = image.getBoundingClientRect().width;
    const maxWidth = Math.max(120, body.clientWidth - 24);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.round(Math.min(Math.max(startWidth + moveEvent.clientX - startX, 120), maxWidth));
      image.setAttribute('width', String(nextWidth));
      image.style.width = `${nextWidth}px`;
      updateResizeHandle();
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', cleanup);
      emitChange();
      updateResizeHandle();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', cleanup);
  };

  const handlePaste: React.ClipboardEventHandler<HTMLDivElement> = (event) => {
    const files = Array.from(event.clipboardData.files || []);
    const image = files.find((file) => file.type.startsWith('image/'));
    if (!image) {
      window.setTimeout(emitChange, 0);
      return;
    }

    event.preventDefault();
    if (image.size > 5 * 1024 * 1024) {
      message.warning('图片不能超过 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => insertImage(String(reader.result || ''));
    reader.readAsDataURL(image);
  };

  const isEmpty = !editorRef.current?.innerText?.trim() && !sanitizeRichText(value);

  return (
    <div className={focused ? 'admin-rich-description is-focused' : 'admin-rich-description'}>
      <div className="admin-rich-description__toolbar">
        <Space size={4}>
          <Tooltip title="加粗">
            <Button size="small" icon={<BoldOutlined />} onClick={() => exec('bold')} />
          </Tooltip>
          <Tooltip title="斜体">
            <Button size="small" icon={<ItalicOutlined />} onClick={() => exec('italic')} />
          </Tooltip>
          <Tooltip title="无序列表">
            <Button size="small" icon={<UnorderedListOutlined />} onClick={() => exec('insertUnorderedList')} />
          </Tooltip>
          <Tooltip title="有序列表">
            <Button size="small" icon={<OrderedListOutlined />} onClick={() => exec('insertOrderedList')} />
          </Tooltip>
        </Space>
      </div>
      <div className="admin-rich-description__body">
        {isEmpty ? <div className="admin-rich-description__placeholder">{placeholder}</div> : null}
        <div
          ref={editorRef}
          className="admin-rich-description__editor"
          contentEditable
          suppressContentEditableWarning
          onInput={emitChange}
          onClick={handleEditorClick}
          onPaste={handlePaste}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            emitChange();
          }}
        />
        {resizeHandle.visible ? (
          <span
            className="admin-rich-description__resize-handle"
            style={{ left: resizeHandle.left, top: resizeHandle.top }}
            onMouseDown={handleResizeStart}
          />
        ) : null}
      </div>
      <div className="admin-rich-description__tip">{tip}</div>
    </div>
  );
}
