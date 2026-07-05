import type { ComponentProps } from 'react';
import { Cascader } from 'antd';
import '../AdminSelect/index.css';
import './index.css';

export function AdminCascader({ className, classNames, popupClassName, ...props }: ComponentProps<typeof Cascader>) {
  const popupRootClassName = [
    'admin-select-popup',
    'admin-cascader-popup',
    popupClassName,
    classNames?.popup?.root
  ].filter(Boolean).join(' ');

  return (
    <Cascader
      allowClear
      showSearch
      notFoundContent="暂无数据"
      className={['admin-select', className].filter(Boolean).join(' ')}
      classNames={{
        ...classNames,
        popup: {
          ...classNames?.popup,
          root: popupRootClassName
        }
      }}
      {...props}
      style={{ width: '100%', ...props.style }}
    />
  );
}
