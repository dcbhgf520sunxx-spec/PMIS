import { useEffect, useRef, useState } from 'react';
import { App, Form } from 'antd';
import { AdminFormItem, AdminModal, AdminPasswordInput } from '../../../components/admin';
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
  onCancel?: () => void | Promise<void>;
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
  const busy = useRef(false);

  useEffect(() => {
    if (open) form.resetFields();
  }, [form, open]);

  const handleCancel = async () => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      await onCancel?.();
      form.resetFields();
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      const values = await form.validateFields();
      await changeCurrentPassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword
      });
      message.success('密码已修改');
      form.resetFields();
      onSuccess?.();
    } catch (error) {
      if (!(error && typeof error === 'object' && 'errorFields' in error)) {
        message.error(error instanceof Error ? error.message : '修改失败');
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={forced ? '首次登录请修改密码' : '修改密码'}
      open={open}
      width={420}
      closable={!saving}
      maskClosable={!forced && !saving}
      keyboard={!saving}
      cancelText={forced ? '退出登录' : '取消'}
      cancelButtonProps={{ disabled: saving }}
      confirmLoading={saving}
      okText={forced ? '确认修改并进入系统' : '确认'}
      onCancel={handleCancel}
      onOk={handleChangePassword}
    >
      <Form className="account-drawer__form" form={form} layout="vertical">
        <AdminFormItem name="oldPassword" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
          <AdminPasswordInput placeholder="请输入原密码" />
        </AdminFormItem>
        <AdminFormItem
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
        </AdminFormItem>
        <AdminFormItem
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
        </AdminFormItem>
      </Form>
    </AdminModal>
  );
}
