import { Form } from 'antd';
import type { FormInstance } from 'antd';
import { AdminFormItem, AdminInput, AdminModal, AdminSelect } from '../../../components/admin';
import type { ArchiveRecord } from '../../../api/archiveApi';

type ArchiveFormValue = {
  archiveTypeId: string;
  name: string;
};

type ArchiveRecordModalProps = {
  form: FormInstance<ArchiveFormValue>;
  open: boolean;
  editingArchive?: ArchiveRecord;
  submitting?: boolean;
  typeOptions: Array<{ label: string; value: string }>;
  onCancel: () => void;
  onSubmit: (values: ArchiveFormValue) => Promise<void> | void;
};

export function ArchiveRecordModal({
  form,
  open,
  editingArchive,
  submitting,
  typeOptions,
  onCancel,
  onSubmit
}: ArchiveRecordModalProps) {
  return (
    <AdminModal
      title={editingArchive ? '编辑档案' : '新增档案'}
      open={open}
      size="small"
      destroyOnHidden
      forceRender
      confirmLoading={submitting}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" preserve={false} onFinish={onSubmit}>
        <AdminFormItem name="archiveTypeId" label="所属类型" rules={[{ required: true, message: '请选择所属类型' }]}>
          <AdminSelect disabled={Boolean(editingArchive)} placeholder="请选择" options={typeOptions} />
        </AdminFormItem>
        <AdminFormItem name="name" label="档案名称" rules={[{ required: true, message: '请输入档案名称' }]}>
          <AdminInput maxLength={100} placeholder="请输入档案名称" />
        </AdminFormItem>
      </Form>
    </AdminModal>
  );
}

export type { ArchiveFormValue };
