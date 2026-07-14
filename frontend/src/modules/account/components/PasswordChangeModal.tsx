import { useEffect, useState } from 'react';
import { App, Form } from 'antd';
import { AdminModal, AdminPasswordInput } from '../../../components/admin';
import { changeCurrentPassword } from '../../../api/authApi';
import './AccountDrawers.css';

type PasswordFormValues = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type PasswordChangeModalProps = {
  open: boolean;
  forced?: boolean;
  onCancel?: () => void;
  onSuccess?: () => void;
};

export function PasswordChangeModal({
  open,
  forced = false,
  onCancel,
  onSuccess
}: PasswordChangeModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<PasswordFormValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) form.resetFields();
  }, [form, open]);

  const handleCancel = () => {
    if (forced) return;
    form.resetFields();
    onCancel?.();
  };

  const handleChangePassword = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await changeCurrentPassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword
      });
      message.success('密码已修改');
      form.resetFields();
      onSuccess?.();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '修改失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={forced ? '首次登录请修改密码' : '修改密码'}
      open={open}
      width={420}
      closable={!forced}
      maskClosable={!forced}
      keyboard={!forced}
      cancelButtonProps={forced ? { style: { display: 'none' } } : undefined}
      confirmLoading={saving}
      okText={forced ? '确认修改并进入系统' : '确认'}
      onCancel={handleCancel}
      onOk={handleChangePassword}
    >
      <Form className="account-drawer__form" form={form} layout="vertical">
        <Form.Item name="oldPassword" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
          <AdminPasswordInput placeholder="请输入原密码" />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label="新密码"
          dependencies={['oldPassword']}
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 6, message: '新密码至少 6 位' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('oldPassword') !== value) return Promise.resolve();
                return Promise.reject(new Error('新密码不能与原密码一致'));
              }
            })
          ]}
        >
          <AdminPasswordInput placeholder="请输入新密码" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="确认新密码"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                return Promise.reject(new Error('两次输入的新密码不一致'));
              }
            })
          ]}
        >
          <AdminPasswordInput placeholder="请再次输入新密码" />
        </Form.Item>
      </Form>
    </AdminModal>
  );
}
