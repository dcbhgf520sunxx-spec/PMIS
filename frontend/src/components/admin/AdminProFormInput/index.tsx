import { cloneElement, isValidElement, type ComponentProps } from 'react';
import { ProFormDatePicker, ProFormDigit, ProFormField, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import zhCNDatePicker from 'antd/es/date-picker/locale/zh_CN';
import { AdminInput, AdminTextArea } from '../AdminInput';

function resolvePlaceholder(placeholder: ComponentProps<typeof ProFormText>['placeholder'], label: ComponentProps<typeof ProFormText>['label']) {
  if (typeof placeholder === 'string') return placeholder;
  return typeof label === 'string' ? `请输入${label}` : undefined;
}

export function AdminProFormText(props: ComponentProps<typeof ProFormText>) {
  return (
    <ProFormField<ComponentProps<typeof AdminInput>>
      {...props}
      valueType="text"
      fieldProps={{
        ...props.fieldProps,
        ...(props.disabled === undefined ? {} : { disabled: props.disabled }),
        placeholder: resolvePlaceholder(props.placeholder ?? props.fieldProps?.placeholder, props.label)
      }}
      renderFormItem={(_value, config) => {
        const { mode: _mode, ...fieldProps } = config as ComponentProps<typeof AdminInput> & { mode?: string };
        return <AdminInput {...fieldProps} />;
      }}
    />
  );
}

export function AdminProFormTextArea(props: Omit<ComponentProps<typeof ProFormTextArea>, 'key'>) {
  // ProForm 的只读长文本会把字段属性传给 span，字数统计只交给编辑控件。
  const { showCount, ...fieldProps } = props.fieldProps ?? {};

  return (
    <ProFormField<ComponentProps<typeof AdminTextArea>>
      {...props}
      valueType="textarea"
      fieldProps={{
        ...fieldProps,
        ...(props.disabled === undefined ? {} : { disabled: props.disabled }),
        placeholder: resolvePlaceholder(props.placeholder ?? props.fieldProps?.placeholder, props.label)
      }}
      renderFormItem={(value, config, defaultDom) => {
        const editConfig = { ...config, showCount };
        if (props.renderFormItem) {
          const editableDom = isValidElement<ComponentProps<typeof AdminTextArea>>(defaultDom)
            ? cloneElement(defaultDom, { showCount })
            : defaultDom;
          return props.renderFormItem(value, editConfig, editableDom);
        }
        const { mode: _mode, ...inputProps } = editConfig as ComponentProps<typeof AdminTextArea> & { mode?: string };
        return <AdminTextArea {...inputProps} />;
      }}
    />
  );
}

export function AdminProFormNumber(props: ComponentProps<typeof ProFormDigit>) {
  const className = ['admin-input', 'admin-number-input', props.fieldProps?.className].filter(Boolean).join(' ');

  return (
    <ProFormDigit
      {...props}
      placeholder={resolvePlaceholder(props.placeholder ?? props.fieldProps?.placeholder, props.label)}
      fieldProps={{
        controls: false,
        ...props.fieldProps,
        className,
        style: { width: '100%', ...props.fieldProps?.style }
      }}
    />
  );
}

export function AdminProFormMoney(props: ComponentProps<typeof ProFormDigit>) {
  return (
    <AdminProFormNumber
      {...props}
      fieldProps={{
        precision: 2,
        step: 0.01,
        stringMode: true,
        ...props.fieldProps
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
