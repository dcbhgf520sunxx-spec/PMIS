import type { ComponentProps } from 'react';
import { TreeSelect } from 'antd';
import './index.css';

export function AdminTreeSelect({ className, classNames, popupClassName, ...props }: ComponentProps<typeof TreeSelect>) {
  const popupRootClassName = [
    'admin-select-popup',
    'admin-tree-select-popup',
    popupClassName,
    classNames?.popup?.root
  ].filter(Boolean).join(' ');

  return (
    <TreeSelect
      allowClear
      showSearch
      treeNodeFilterProp="title"
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

AdminTreeSelect.SHOW_ALL = TreeSelect.SHOW_ALL;
AdminTreeSelect.SHOW_CHILD = TreeSelect.SHOW_CHILD;
AdminTreeSelect.SHOW_PARENT = TreeSelect.SHOW_PARENT;
