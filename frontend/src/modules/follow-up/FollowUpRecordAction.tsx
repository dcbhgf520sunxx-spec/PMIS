import { useState } from 'react';
import { Alert, App } from 'antd';
import {
  AdminButton,
  AdminEditIconAction,
  AdminFormItem,
  AdminModal,
  AdminTextAction,
  AdminTextArea,
} from '../../components/admin';
import {
  createFollowUpRecord,
  updateFollowUpRecord,
  type FollowUpRecord,
  type FollowUpTargetType,
} from '../../api/followUpRecordApi';

export type FollowUpTarget = { type: FollowUpTargetType; id: string; name: string };

type Props = {
  target: FollowUpTarget;
  record?: FollowUpRecord;
  variant?: 'button' | 'text' | 'icon';
  onSaved?: () => Promise<void> | void;
};

type ModalProps = {
  target: FollowUpTarget;
  record?: FollowUpRecord;
  open: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
};

function validateContent(value: string) {
  const content = value.trim();
  if (!content) return '请输入跟进内容';
  if ([...content].length > 200) return '跟进内容不能超过200字';
  return '';
}

export function FollowUpRecordModal({ target, record, open, onClose, onSaved }: ModalProps) {
  const { message } = App.useApp();
  const [content, setContent] = useState(record?.content || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const validationError = validateContent(content);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (record) await updateFollowUpRecord(target.type, target.id, record.id, content.trim());
      else await createFollowUpRecord(target.type, target.id, content.trim());
      message.success(record ? '跟进记录修改成功' : '跟进记录新增成功');
      onClose();
      await onSaved?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存跟进记录失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={record ? '编辑跟进记录' : '新增跟进记录'}
      open={open}
      size="small"
      okText="保存"
      confirmLoading={saving}
      onCancel={onClose}
      onOk={() => void save()}
    >
      <AdminFormItem
        label="跟进内容"
        required
        validateStatus={error ? 'error' : undefined}
        help={error || undefined}
      >
        <AdminTextArea
          autoFocus
          rows={5}
          maxLength={200}
          showCount
          value={content}
          placeholder="请输入跟进内容"
          onChange={(event) => {
            setContent(event.target.value);
            if (error) setError('');
          }}
        />
      </AdminFormItem>
      {error && !['请输入跟进内容', '跟进内容不能超过200字'].includes(error)
        ? <Alert type="error" showIcon message={error} />
        : null}
    </AdminModal>
  );
}

export function FollowUpRecordAction({ target, record, variant = 'text', onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const label = record ? '编辑跟进记录' : '新增跟进记录';
  return (
    <>
      {variant === 'icon'
        ? <AdminEditIconAction onClick={() => setOpen(true)} />
        : variant === 'text'
          ? <AdminTextAction onClick={() => setOpen(true)}>{label}</AdminTextAction>
          : <AdminButton size="small" type="primary" onClick={() => setOpen(true)}>新增跟进记录</AdminButton>}
      {open ? (
        <FollowUpRecordModal
          key={record?.id || 'new'}
          target={target}
          record={record}
          open
          onClose={() => setOpen(false)}
          onSaved={onSaved}
        />
      ) : null}
    </>
  );
}
