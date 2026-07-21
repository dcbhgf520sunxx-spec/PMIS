import type { ComponentProps } from 'react';
import { ProForm, ProFormDatePicker, ProFormDigit, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import zhCNDatePicker from 'antd/es/date-picker/locale/zh_CN';
import { AdminInput, AdminTextArea } from '../AdminInput';

function resolvePlaceholder(placeholder: ComponentProps<typeof ProFormText>['placeholder'], label: ComponentProps<typeof ProFormText>['label']) {
  if (typeof placeholder === 'string') return placeholder;
  return typeof label === 'string' ? `请输入${label}` : undefined;
}

export function AdminProFormText(props: ComponentProps<typeof ProFormText>) {
  const {
    fieldProps,
    formItemProps,
    placeholder,
    disabled,
    name,
    label,
    rules,
    className,
    ...restProps
  } = props;

  return (
    <ProForm.Item
      {...restProps}
      {...formItemProps}
      name={name}
      label={label}
      rules={rules}
      className={[className, formItemProps?.className].filter(Boolean).join(' ')}
    >
      <AdminInput
        {...fieldProps}
        disabled={disabled}
        placeholder={resolvePlaceholder(placeholder, label)}
      />
    </ProForm.Item>
  );
}

export function AdminProFormTextArea(props: ComponentProps<typeof ProFormTextArea>) {
  const {
    fieldProps,
    formItemProps,
    placeholder,
    disabled,
    name,
    label,
    rules,
    className,
    ...restProps
  } = props;

  return (
    <ProForm.Item
      {...restProps}
      {...formItemProps}
      name={name}
      label={label}
      rules={rules}
      className={[className, formItemProps?.className].filter(Boolean).join(' ')}
    >
      <AdminTextArea
        {...fieldProps}
        disabled={disabled}
        placeholder={resolvePlaceholder(placeholder, label)}
      />
    </ProForm.Item>
  );
}

export function AdminProFormMoney(props: ComponentProps<typeof ProFormDigit>) {
  const className = ['admin-input', props.fieldProps?.className].filter(Boolean).join(' ');

  return (
    <ProFormDigit
      {...props}
      fieldProps={{
        precision: 2,
        step: 0.01,
        stringMode: true,
        controls: false,
        ...props.fieldProps,
        className,
        style: { width: '100%', ...props.fieldProps?.style }
      }}
    />
  );
}

export function AdminProFormDatePicker(props: ComponentProps<typeof ProFormDatePicker>) {
  const className = ['admin-date-picker', props.fieldProps?.className].filter(Boolean).join(' ');

  return (
    <ProFormDatePicker
      {...props}
      fieldProps={{
        locale: zhCNDatePicker,
        ...props.fieldProps,
        className
      }}
    />
  );
}
