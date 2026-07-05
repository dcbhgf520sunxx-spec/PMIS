import { useState } from 'react';
import type { ReactNode } from 'react';
import { App, Button, Spin } from 'antd';
import { ProForm, type ProFormInstance } from '@ant-design/pro-components';
import { ActionBar } from '../ActionBar';
import { FormPage } from '../FormPage';
import { PageShell } from '../PageShell';
import { SectionTitle } from '../SectionTitle';
import './index.css';

type TemplateFormPageProps<T extends Record<string, unknown>> = {
  title: string;
  formId: string;
  form?: ProFormInstance<T>;
  initialValues?: Partial<T>;
  loading?: boolean;
  submitting?: boolean;
  titleExtra?: ReactNode;
  children: ReactNode;
  onSubmit: (values: T) => Promise<void> | void;
  onSubmitError?: (error: unknown, form: ProFormInstance<T>) => boolean | void;
  onCancel: () => void;
};

type TemplateFormSectionProps = {
  title: string;
  children: ReactNode;
};

export function TemplateFormPage<T extends Record<string, unknown>>({
  title,
  formId,
  form,
  initialValues,
  loading,
  submitting,
  titleExtra,
  children,
  onSubmit,
  onSubmitError,
  onCancel
}: TemplateFormPageProps<T>) {
  const { message } = App.useApp();
  const [innerForm] = ProForm.useForm<T>();
  const formInstance = form || innerForm;
  const [innerSubmitting, setInnerSubmitting] = useState(false);

  const handleSubmit = async () => {
    const values = await formInstance.validateFields();
    try {
      setInnerSubmitting(true);
      await onSubmit(values as T);
    } catch (error) {
      const handled = onSubmitError?.(error, formInstance);
      if (!handled) {
        message.error(error instanceof Error ? error.message : '保存失败');
      }
    } finally {
      setInnerSubmitting(false);
    }
  };

  return (
    <PageShell
      title={title}
      compact
      titleExtra={titleExtra}
      actions={(
        <ActionBar>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" loading={submitting || innerSubmitting} onClick={handleSubmit}>保存</Button>
        </ActionBar>
      )}
    >
      <Spin spinning={Boolean(loading)}>
        <FormPage<T>
          id={formId}
          form={formInstance}
          initialValues={initialValues}
          showActions={false}
          onCancel={onCancel}
          onSubmit={onSubmit}
        >
          <div className="admin-template-form-page">
            {children}
          </div>
        </FormPage>
      </Spin>
    </PageShell>
  );
}

export function TemplateFormSection({ title, children }: TemplateFormSectionProps) {
  return (
    <section className="admin-template-form-page__panel">
      <SectionTitle title={title} />
      {children}
    </section>
  );
}
