import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Button } from 'antd';
import { ProForm } from '@ant-design/pro-components';
import type { ProFormInstance } from '@ant-design/pro-components';
import './index.css';

type FormPageProps<T extends Record<string, unknown>> = {
  id?: string;
  form?: ProFormInstance<T>;
  initialValues?: Partial<T>;
  readonly?: boolean;
  submitting?: boolean;
  showActions?: boolean;
  children: ReactNode;
  onSubmit: (values: T) => Promise<void> | void;
  onCancel: () => void;
};

export function FormPage<T extends Record<string, unknown>>({
  id,
  form,
  initialValues,
  readonly,
  submitting,
  showActions = true,
  children,
  onSubmit,
  onCancel
}: FormPageProps<T>) {
  const [innerForm] = ProForm.useForm<T>();
  const formInstance = form || innerForm;

  useEffect(() => {
    if (initialValues) {
      formInstance.setFieldsValue(initialValues as Parameters<typeof formInstance.setFieldsValue>[0]);
    } else {
      formInstance.resetFields();
    }
  }, [formInstance, initialValues]);

  return (
    <ProForm<T>
      id={id}
      form={formInstance}
      className="form-page"
      dateFormatter={false}
      readonly={readonly}
      submitter={showActions ? {
        searchConfig: {
          submitText: '保存'
        },
        submitButtonProps: { loading: submitting },
        render: (_, dom) => (
          <div className="form-page__actions">
            <Button onClick={onCancel}>取消</Button>
            {Array.isArray(dom) ? dom[1] : dom}
          </div>
        )
      } : false}
      onFinish={async (values) => {
        await onSubmit(values);
        return true;
      }}
    >
      {children}
    </ProForm>
  );
}
