import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';
import { Tooltip } from 'antd';
import type { FormListFieldData, FormListProps } from 'antd/es/form/FormList';
import { ProFormList } from '@ant-design/pro-components';
import { AdminTextAction } from '../AdminTextAction';
import './index.css';

export type AdminProFormEditableListField = {
  key: string;
  title: string;
  render: (context: { field: FormListFieldData; index: number }) => ReactNode;
};

type EditableListStyle = CSSProperties & {
  '--admin-editable-list-columns': string;
};

export type AdminProFormEditableListProps<T extends Record<string, unknown>> = {
  name: FormListProps['name'];
  label?: ReactNode;
  fields: AdminProFormEditableListField[];
  creatorRecord: T | (() => T);
};

const MIN_ROWS = 1;
const FIELD_WIDTH = 'minmax(160px, 280px)';

export function AdminProFormEditableList<T extends Record<string, unknown>>({
  name,
  label,
  fields,
  creatorRecord
}: AdminProFormEditableListProps<T>) {
  const initialValue = useMemo(
    () => Array.from({ length: MIN_ROWS }, () => (
      typeof creatorRecord === 'function' ? creatorRecord() : { ...creatorRecord }
    )),
    [creatorRecord]
  );
  const style = {
    '--admin-editable-list-columns': `64px ${fields.map(() => FIELD_WIDTH).join(' ')} 72px`
  } as EditableListStyle;

  return (
    <div className="admin-pro-form-editable-list" style={style}>
      {label ? <div className="admin-pro-form-editable-list__label">{label}</div> : null}
      <div className="admin-pro-form-editable-list__header" aria-hidden="true">
        <span>序号</span>
        {fields.map((field) => <span key={field.key}>{field.title}</span>)}
        <span>操作</span>
      </div>
      <ProFormList<T>
        name={name}
        min={MIN_ROWS}
        initialValue={initialValue}
        creatorRecord={creatorRecord}
        creatorButtonProps={{
          creatorButtonText: '新增',
          type: 'dashed',
          block: true
        }}
        copyIconProps={false}
        deleteIconProps={false}
        actionRender={() => []}
      >
        {(field, index, action, count) => {
          const cannotDelete = count <= MIN_ROWS;
          const deleteReason = `至少保留 ${MIN_ROWS} 行`;

          return (
            <div className="admin-pro-form-editable-list__row">
              <div className="admin-pro-form-editable-list__sequence" data-label="序号">
                <span className="admin-pro-form-editable-list__mobile-label">序号</span>
                <span>{index + 1}</span>
              </div>
              {fields.map((item) => (
                <div
                  className="admin-pro-form-editable-list__cell"
                  data-label={item.title}
                  key={item.key}
                >
                  <span className="admin-pro-form-editable-list__mobile-label">{item.title}</span>
                  {item.render({ field, index })}
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
