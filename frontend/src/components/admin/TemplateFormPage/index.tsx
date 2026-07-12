import { useState } from 'react';
import type { ReactNode } from 'react';
import { App } from 'antd';
import { ProForm, type ProFormInstance } from '@ant-design/pro-components';
import { ActionBar } from '../ActionBar';
import { AdminEmptyState } from '../AdminEmptyState';
import { AdminButton } from '../AdminPrimitives';
import { FormPage } from '../FormPage';
import { PageShell } from '../PageShell';
import { SectionTitle } from '../SectionTitle';
import { ApiError } from '../../../api/apiError';
import './index.css';

type TemplateFormPageProps<T extends Record<string, unknown>> = {
  title: string;
  formId: string;
  form?: ProFormInstance<T>;
  initialValues?: Partial<T>;
  loading?: boolean;
  submitting?: boolean;
  error?: ReactNode;
  notFound?: boolean;
  onRetry?: () => void;
  titleExtra?: ReactNode;
  children: ReactNode;
  onSubmit: (values: T) => Promise<void> | void;
  onSubmitError?: (error: unknown, form: ProFormInstance<T>) => boolean | void;
  fieldNameMap?: Record<string, string>;
  onCancel: () => void;
};

type TemplateFormSectionProps = {
  title: string;
  children: ReactNode;
};

function applyApiFieldErrors<T extends Record<string, unknown>>(
  error: unknown,
  form: ProFormInstance<T>,
  fieldNameMap: Record<string, string>
) {
  if (!(error instanceof ApiError) || !error.fieldErrors) return false;
  const fields = Object.entries(error.fieldErrors).map(([field, errors]) => ({
    name: fieldNameMap[field] || field,
    errors
  }));
  if (fields.length === 0) return false;

  form.setFields(fields as Parameters<typeof form.setFields>[0]);
  form.scrollToField(fields[0].name as never, { block: 'center' });
  return true;
}

export function TemplateFormPage<T extends Record<string, unknown>>({
  title,
  formId,
  form,
  initialValues,
  loading,
  submitting,
  error,
  notFound,
  onRetry,
  titleExtra,
  children,
  onSubmit,
  onSubmitError,
  fieldNameMap = {},
  onCancel
}: TemplateFormPageProps<T>) {
  const { message } = App.useApp();
  const [innerForm] = ProForm.useForm<T>();
  const formInstance = form || innerForm;
  const [innerSubmitting, setInnerSubmitting] = useState(false);

  const isUnavailable = Boolean(error) || Boolean(notFound);
  const isSubmitting = Boolean(submitting || innerSubmitting);

  const handleSubmit = async (values: T) => {
    try {
      setInnerSubmitting(true);
      await onSubmit(values);
    } catch (error) {
      const handled = applyApiFieldErrors(error, formInstance, fieldNameMap)
        || onSubmitError?.(error, formInstance);
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
      loading={Boolean(loading)}
      titleExtra={titleExtra}
      actions={(
        <ActionBar>
          <AdminButton disabled={isSubmitting} onClick={onCancel}>取消</AdminButton>
          {!isUnavailable ? (
            <AdminButton type="primary" htmlType="submit" form={formId} loading={isSubmitting}>保存</AdminButton>
          ) : null}
        </ActionBar>
      )}
    >
      {isUnavailable ? (
        <div className="admin-template-form-page__state">
          <AdminEmptyState description={notFound ? '记录不存在或已被删除' : error}>
            {onRetry ? <AdminButton type="primary" onClick={onRetry}>重新加载</AdminButton> : null}
          </AdminEmptyState>
        </div>
      ) : (
        <FormPage<T>
          id={formId}
          form={formInstance}
          initialValues={initialValues}
          showActions={false}
          onCancel={onCancel}
          onSubmit={handleSubmit}
        >
          <div className="admin-template-form-page">
            {children}
          </div>
        </FormPage>
      )}
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
