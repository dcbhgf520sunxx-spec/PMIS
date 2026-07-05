import { forwardRef } from 'react';
import type { ForwardedRef, ReactElement, RefAttributes } from 'react';
import { Select } from 'antd';
import type { SelectProps } from 'antd';
import type { BaseOptionType, DefaultOptionType, RefSelectProps } from 'antd/es/select';
import './index.css';

function optionText(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

export function filterSelectOption(input: string, option?: BaseOptionType | DefaultOptionType) {
  const keyword = input.trim().toLowerCase();
  if (!keyword) return true;

  return [option?.label, option?.value, option?.children]
    .map(optionText)
    .some((text) => text.toLowerCase().includes(keyword));
}

export const searchableSelectProps = {
  showSearch: true,
  optionFilterProp: 'label',
  filterOption: filterSelectOption,
  notFoundContent: '暂无数据',
  className: 'admin-select',
  classNames: { popup: { root: 'admin-select-popup' } }
};

export type AdminSelectProps<
  ValueType = unknown,
  OptionType extends BaseOptionType = DefaultOptionType
> = SelectProps<ValueType, OptionType>;

function AdminSelectBase<
  ValueType = unknown,
  OptionType extends BaseOptionType = DefaultOptionType
>(props: AdminSelectProps<ValueType, OptionType>, ref: ForwardedRef<RefSelectProps>) {
  const { className: propsClassName, classNames: propsClassNames, popupClassName, ...restProps } = props;
  const className = ['admin-select', propsClassName].filter(Boolean).join(' ');
  const popupRootClassName = [
    'admin-select-popup',
    popupClassName,
    propsClassNames?.popup?.root
  ].filter(Boolean).join(' ');

  return (
    <Select
      ref={ref}
      allowClear
      showSearch
      optionFilterProp="label"
      filterOption={filterSelectOption}
      notFoundContent="暂无数据"
      {...restProps}
      className={className}
      classNames={{
        ...propsClassNames,
        popup: {
          ...propsClassNames?.popup,
          root: popupRootClassName
        }
      }}
      style={{ width: '100%', ...restProps.style }}
    />
  );
}

export const AdminSelect = forwardRef(AdminSelectBase) as <
  ValueType = unknown,
  OptionType extends BaseOptionType = DefaultOptionType
>(
  props: AdminSelectProps<ValueType, OptionType> & RefAttributes<RefSelectProps>
) => ReactElement;
