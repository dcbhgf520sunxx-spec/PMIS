import { useState } from 'react';
import { Form } from 'antd';
import { ProForm } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import {
  AdminButton, AdminCard, AdminFormItem, AdminProFormDatePicker, AdminProFormMoney,
  AdminProFormNumber, AdminProFormSelect, AdminProFormText, AdminProFormTextArea,
  AdminSegmented, AdminSwitch, AdminText, FormPage
} from '../../../../../components/admin';
import { ComponentEntry } from '../../components/ComponentEntry';

type ExampleValues = {
  code: string;
  quantity: number;
  amount: string;
  ratio: number;
  effectiveDate: dayjs.Dayjs;
  category: string;
  enabled: boolean;
  description?: string;
};

const initialValues: ExampleValues = {
  code: '000123', quantity: 0, amount: '0.00', ratio: 0,
  effectiveDate: dayjs('2026-11-13'), category: 'pending', enabled: false
};

type FieldMode = 'editable' | 'disabled' | 'readonly' | 'formReadonly';

export function FormFieldExamples() {
  const [form] = ProForm.useForm<ExampleValues>();
  const [mode, setMode] = useState<FieldMode>('editable');
  const [submitted, setSubmitted] = useState('');
  const enabled = Form.useWatch('enabled', { form, preserve: true });
  const stateProps = mode === 'readonly' ? { readonly: true } : mode === 'disabled' ? { disabled: true } : {};
  const isReadOnly = mode === 'readonly' || mode === 'formReadonly';

  return (
    <AdminCard title="字段类型与状态">
      <div className="design-system-page__input-panel-head">
        <h3>字段录入与校验</h3>
        <p>编号保留前导零，数量使用整数，金额保留精度，比例声明范围。切换状态后可核对禁用与只读效果，清空必填项可查看字段下方的错误提示。</p>
        <ComponentEntry name="AdminProFormNumber / AdminProFormMoney / AdminProFormText / AdminProFormSelect / AdminProFormDatePicker" />
      </div>
      <AdminSegmented
        aria-label="字段示例状态"
        value={mode}
        options={[
          { label: '可编辑', value: 'editable' }, { label: '字段禁用', value: 'disabled' },
          { label: '字段只读', value: 'readonly' }, { label: '整表只读', value: 'formReadonly' }
        ]}
        onChange={value => setMode(value as FieldMode)}
      />
      <FormPage<ExampleValues>
        id="field-input-example" form={form} initialValues={initialValues}
        readonly={mode === 'formReadonly'} showActions={false}
        onValuesChange={() => setSubmitted('')}
        onCancel={() => setSubmitted('')}
        onSubmit={values => setSubmitted(JSON.stringify({
          ...values, effectiveDate: values.effectiveDate?.format('YYYY-MM-DD')
        }, null, 2))}
      >
        <div className="admin-template-form-page">
          <div className="admin-template-form-page__grid">
            <AdminProFormText {...stateProps} name="code" label="编号"
              fieldProps={{ maxLength: 12 }}
              rules={[{ required: true, whitespace: true, message: '请输入编号' }, { max: 12, message: '编号最多12个字符' }]} />
            <AdminProFormNumber {...stateProps} name="quantity" label="数量"
              fieldProps={{ min: 0, max: 100, precision: 0, step: 1 }}
              rules={[{ required: true, message: '请输入数量' }, { type: 'integer', min: 0, max: 100, message: '数量须为0至100的整数' }]} />
            <AdminProFormMoney {...stateProps} name="amount" label="金额（元）"
              fieldProps={{ min: 0, max: 10000000000000000 }}
              rules={[{ required: true, message: '请输入金额' }]} />
            <AdminProFormNumber {...stateProps} name="ratio" label="比例（%）"
              fieldProps={{ min: 0, max: 100, precision: 2, step: 0.01 }}
              rules={[{ required: true, message: '请输入比例' }, { type: 'number', min: 0, max: 100, message: '比例须在0至100之间' }]} />
            <AdminProFormDatePicker {...stateProps} name="effectiveDate" label="生效日期"
              rules={[{ required: true, message: '请选择生效日期' }]} />
            <AdminProFormSelect {...stateProps} name="category" label="分类"
              fieldProps={{ allowClear: true }}
              options={[{ label: '待处理', value: 'pending' }, { label: '已处理', value: 'done' }]}
              rules={[{ required: true, message: '请选择分类' }]} />
            {isReadOnly ? (
              <AdminFormItem label="是否启用"><AdminText>{enabled ? '是' : '否'}</AdminText></AdminFormItem>
            ) : (
              <AdminFormItem name="enabled" label="是否启用" valuePropName="checked">
                <AdminSwitch disabled={mode === 'disabled'} checkedChildren="是" unCheckedChildren="否" />
              </AdminFormItem>
            )}
            <AdminProFormTextArea {...stateProps} name="description" label="说明"
              fieldProps={{ rows: 3, maxLength: 200, showCount: true }}
              rules={[{ max: 200, message: '说明最多200个字符' }]} />
          </div>
        </div>
      </FormPage>
      <AdminButton type="primary" htmlType="submit" form="field-input-example" disabled={mode !== 'editable'}>校验并查看结果</AdminButton>
      {submitted ? <pre aria-label="字段提交结果">{submitted}</pre> : null}
    </AdminCard>
  );
}
