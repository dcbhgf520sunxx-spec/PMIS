import type { ComponentProps } from 'react';
import { ProFormSelect } from '@ant-design/pro-components';
import { searchableSelectProps } from '../AdminSelect';

function resolvePlaceholder(
  placeholder: ComponentProps<typeof ProFormSelect>['placeholder'],
  label: ComponentProps<typeof ProFormSelect>['label']
) {
  if (typeof placeholder === 'string') return placeholder;
  return typeof label === 'string' ? `请选择${label}` : undefined;
}

export function AdminProFormSelect(props: ComponentProps<typeof ProFormSelect>) {
  const className = ['admin-select', props.fieldProps?.className].filter(Boolean).join(' ');
  const fieldClassNames = props.fieldProps?.classNames;
  const popupRootClassName = [
    'admin-select-popup',
    props.fieldProps?.popupClassName,
    fieldClassNames?.popup?.root
  ].filter(Boolean).join(' ');

  return (
    <ProFormSelect
      {...props}
      placeholder={resolvePlaceholder(props.placeholder, props.label)}
      fieldProps={{
        ...searchableSelectProps,
        ...props.fieldProps,
        className,
        popupClassName: undefined,
        classNames: {
          ...fieldClassNames,
          popup: {
            ...fieldClassNames?.popup,
            root: popupRootClassName
          }
        }
      }}
    />
  );
}
