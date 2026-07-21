import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';
import { Tooltip } from 'antd';
import type { FormListFieldData, FormListProps } from 'antd/es/form/FormList';
import { ProFormList } from '@ant-design/pro-components';
import { AdminTextAction } from '../AdminTextAction';
import './index.css';

export type AdminProFormEditableListColumn = {
  key: string;
  title: string;
  width?: number | string;
  render: (context: { field: FormListFieldData; index: number }) => ReactNode;
};

type EditableListStyle = CSSProperties & {
  '--admin-editable-list-columns': string;
};

export type AdminProFormEditableListProps<T extends Record<string, unknown>> = {
  name: FormListProps['name'];
  label?: ReactNode;
  columns: AdminProFormEditableListColumn[];
  creatorRecord: T | (() => T);
  addText?: ReactNode;
  minRows?: number;
  maxRows?: number;
  readonly?: boolean;
};

function columnWidth(width: number | string | undefined) {
  if (typeof width === 'number') return `${width}px`;
  return width || 'minmax(160px, 280px)';
}

export function AdminProFormEditableList<T extends Record<string, unknown>>({
  name,
  label,
  columns,
  creatorRecord,
  addText = '新增',
  minRows = 1,
  maxRows,
  readonly = false
}: AdminProFormEditableListProps<T>) {
  const normalizedMinRows = Math.max(0, minRows);
  const initialValue = useMemo(
    () => Array.from({ length: normalizedMinRows }, () => (
      typeof creatorRecord === 'function' ? creatorRecord() : { ...creatorRecord }
    )),
    [creatorRecord, normalizedMinRows]
  );
  const style = {
    '--admin-editable-list-columns': `64px ${columns.map((column) => columnWidth(column.width)).join(' ')} 72px`
  } as EditableListStyle;

  return (
    <div className="admin-pro-form-editable-list" style={style}>
      {label ? <div className="admin-pro-form-editable-list__label">{label}</div> : null}
      <div className="admin-pro-form-editable-list__header" aria-hidden="true">
        <span>序号</span>
        {columns.map((column) => <span key={column.key}>{column.title}</span>)}
        <span>操作</span>
      </div>
      <ProFormList<T>
        name={name}
        min={normalizedMinRows}
        max={maxRows}
        initialValue={initialValue}
        creatorRecord={creatorRecord}
        creatorButtonProps={readonly ? false : {
          creatorButtonText: addText,
          type: 'dashed',
          block: true
        }}
        copyIconProps={false}
        deleteIconProps={false}
        actionRender={() => []}
      >
        {(field, index, action, count) => {
          const cannotDelete = readonly || count <= normalizedMinRows;
          const deleteReason = readonly
            ? '只读状态不能删除'
            : `至少保留 ${normalizedMinRows} 行`;

          return (
            <div className="admin-pro-form-editable-list__row">
              <div className="admin-pro-form-editable-list__sequence" data-label="序号">
                <span className="admin-pro-form-editable-list__mobile-label">序号</span>
                <span>{index + 1}</span>
              </div>
              {columns.map((column) => (
                <div
                  className="admin-pro-form-editable-list__cell"
                  data-label={column.title}
                  key={column.key}
                >
                  <span className="admin-pro-form-editable-list__mobile-label">{column.title}</span>
                  {column.render({ field, index })}
                </div>
              ))}
              <div className="admin-pro-form-editable-list__operation" data-label="操作">
                <span className="admin-pro-form-editable-list__mobile-label">操作</span>
                <Tooltip title={cannotDelete ? deleteReason : undefined}>
                  <span>
                    <AdminTextAction
                      danger
                      disabled={cannotDelete}
                      onClick={() => action.remove(field.name)}
                    >
                      删除
                    </AdminTextAction>
                  </span>
                </Tooltip>
              </div>
            </div>
          );
        }}
      </ProFormList>
    </div>
  );
}
