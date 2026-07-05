import { Form } from 'antd';
import type { FormInstance } from 'antd';
import { AdminInput, AdminModal } from '../../../components/admin';
import { checkArchiveTypePrefix, type ArchiveTypeRecord } from '../../../api/archiveApi';

type TypeFormValue = {
  codePrefix?: string;
  name: string;
};

type ArchiveTypeModalProps = {
  form: FormInstance<TypeFormValue>;
  open: boolean;
  editingType?: ArchiveTypeRecord;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: TypeFormValue) => Promise<void> | void;
};

export function ArchiveTypeModal({
  form,
  open,
  editingType,
  submitting,
  onCancel,
  onSubmit
}: ArchiveTypeModalProps) {
  return (
    <AdminModal
      title={editingType ? '编辑档案类型' : '新增档案类型'}
      open={open}
      size="small"
      destroyOnHidden
      forceRender
      confirmLoading={submitting}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" preserve={false} onFinish={onSubmit}>
        <Form.Item
          name="codePrefix"
          label="编码前缀"
          extra="将作为该类型下档案编码的自动生成前缀，如 TT -> TT001"
          rules={[
            { required: !editingType, message: '请输入编码前缀' },
            {
              validator: async (_, value) => {
                if (editingType || !value) return;
                const result = await checkArchiveTypePrefix(value);
                if (!result.available) throw new Error('编码前缀已存在');
              }
            }
          ]}
        >
          <AdminInput disabled={Boolean(editingType)} maxLength={10} placeholder="如 TT" />
        </Form.Item>
        <Form.Item name="name" label="类型名称" rules={[{ required: true, message: '请输入类型名称' }]}>
          <AdminInput maxLength={100} placeholder="如 问题类型" />
        </Form.Item>
      </Form>
    </AdminModal>
  );
}

export type { TypeFormValue };
