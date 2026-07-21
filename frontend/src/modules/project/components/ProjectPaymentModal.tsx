import { useEffect, useState } from 'react';
import { App } from 'antd';
import { ProForm } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { AdminModal, AdminProFormDatePicker, AdminProFormMoney, AdminProFormSelect, AdminProFormTextArea, AdminSpace, InfoGrid } from '../../../components/admin';
import { ApiError } from '../../../api/apiError';
import { createProjectPayment, updateProjectPayment } from '../../../api/projectApi';
import type { ProjectPaymentFormValues, ProjectPaymentRecord, ProjectPaymentStage } from '../types';

type ProjectPaymentModalProps = {
  open: boolean;
  projectId: string;
  stage?: ProjectPaymentStage;
  payment?: ProjectPaymentRecord;
  userOptions: Array<{ label: string; value: string }>;
  onClose: () => void;
  onSaved: () => void;
};

const amountPattern = /^\d+(?:\.\d{1,2})?$/;
const money = (value: number) => value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ProjectPaymentModal({ open, projectId, stage, payment, userOptions, onClose, onSaved }: ProjectPaymentModalProps) {
  const { message } = App.useApp();
  const [form] = ProForm.useForm<ProjectPaymentFormValues>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(payment ? {
      paymentAmount: payment.paymentAmount.toFixed(2),
      paymentMonth: dayjs(`${payment.paymentMonth}-01`) as unknown as string,
      handlerId: payment.handlerId,
      remark: payment.remark,
    } : { paymentAmount: stage?.unpaidAmount.toFixed(2) ?? '', paymentMonth: undefined, handlerId: undefined, remark: '' } as unknown as ProjectPaymentFormValues);
  }, [form, open, payment, stage]);

  const submit = async () => {
    if (!stage) return;
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (payment) await updateProjectPayment(projectId, payment.id, values);
      else await createProjectPayment(projectId, stage.id, values);
      message.success(payment ? '付款记录已更新' : '付款登记成功');
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        const fieldMap: Record<string, keyof ProjectPaymentFormValues> = { payment_amount: 'paymentAmount', payment_month: 'paymentMonth', handler_id: 'handlerId' };
        form.setFields(Object.entries(error.fieldErrors).map(([field, errors]) => ({ name: fieldMap[field] || field, errors })) as never);
      } else if (error instanceof Error && !('errorFields' in error)) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminModal
      title={payment ? '更正付款' : `登记付款：${stage?.stageName || ''}`}
      open={open}
      confirmLoading={submitting}
      onCancel={onClose}
      onOk={submit}
      destroyOnHidden
    >
      <AdminSpace direction="vertical" size={16} style={{ width: '100%' }}>
        {stage ? (
          <InfoGrid
            columns={3}
            items={[
              { label: '计划金额（元）', value: money(stage.plannedAmount) },
              { label: '已付金额（元）', value: money(stage.paidAmount) },
              { label: '待付金额（元）', value: money(stage.unpaidAmount) },
            ]}
          />
        ) : null}
        <ProForm<ProjectPaymentFormValues> form={form} submitter={false} layout="vertical">
          <AdminProFormMoney
            name="paymentAmount"
            label="本次付款金额（元）"
            rules={[
              { required: true, message: '请输入本次付款金额' },
              { pattern: amountPattern, message: '请输入最多两位小数的金额' },
              { validator: async (_: unknown, value: unknown) => { if (Number(value) <= 0) throw new Error('本次付款金额必须大于0'); } },
            ]}
            fieldProps={{ inputMode: 'decimal' }}
          />
          <AdminProFormDatePicker
            name="paymentMonth"
            label="付款时间"
            rules={[{ required: true, message: '请选择付款时间' }]}
            fieldProps={{ picker: 'month', format: 'YYYY-MM', maxDate: dayjs().endOf('month') }}
          />
          <AdminProFormSelect name="handlerId" label="经办人" rules={[{ required: true, message: '请选择经办人' }]} options={userOptions} />
          <AdminProFormTextArea name="remark" label="备注" fieldProps={{ rows: 3, maxLength: 1000 }} />
        </ProForm>
      </AdminSpace>
    </AdminModal>
  );
}
