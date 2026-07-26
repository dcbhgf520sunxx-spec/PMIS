import { type ReactNode } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import {
  AdminTextAction,
  DeleteConfirmAction,
  OperationColumnActions,
  StatusConfirmAction,
  StatusTag,
  TemplateListPage,
  type TemplateListPagination
} from '../../../components/admin';
import type { ArchiveRecord } from '../../../api/archiveApi';

type ArchiveRecordTableProps = {
  rows: ArchiveRecord[];
  filter: ReactNode;
  pagination: TemplateListPagination;
  renderIndex: (index: number) => number;
  loading?: boolean;
  onEdit: (record: ArchiveRecord) => void;
  onToggleStatus: (record: ArchiveRecord) => Promise<void> | void;
  onDelete: (record: ArchiveRecord) => Promise<void> | void;
  onSortChange: (activeRecord: ArchiveRecord, targetRecord: ArchiveRecord) => Promise<void> | void;
};

export function ArchiveRecordTable({
  rows,
  filter,
  pagination,
  renderIndex,
  loading,
  onEdit,
  onToggleStatus,
  onDelete,
  onSortChange
}: ArchiveRecordTableProps) {
  const columns: ProColumns<ArchiveRecord>[] = [
    {
      title: '序号',
      width: 64,
      search: false,
      render: (_, __, index) => (
        <span>{renderIndex(index)}</span>
      )
    },
    { title: '档案编码', dataIndex: 'code', width: 112, search: false },
    { title: '档案名称', dataIndex: 'name', width: 160, ellipsis: true, search: false },
    {
      title: '状态',
      dataIndex: 'status',
      width: 84,
      search: false,
      render: (_, record) => <StatusTag status={record.status} />
    },
    { title: '创建人', dataIndex: 'creatorName', width: 82, search: false },
    { title: '创建时间', dataIndex: 'createdAt', width: 150, search: false },
    {
      title: '操作',
      width: 188,
      valueType: 'option',
      render: (_, record) => (
        <OperationColumnActions>
          <AdminTextAction onClick={() => onEdit(record)}>编辑</AdminTextAction>
          <StatusConfirmAction
            variant="text"
            action={record.status === 'enabled' ? 'disable' : 'enable'}
            entityName="档案"
            targetName={record.name}
            onConfirm={() => onToggleStatus(record)}
            successMessage={false}
          >
            {record.status === 'enabled' ? '停用' : '启用'}
          </StatusConfirmAction>
          <DeleteConfirmAction
            variant="text"
            entityName="档案"
            targetName={record.name}
            onConfirm={() => onDelete(record)}
            successMessage={false}
          >
            删除
          </DeleteConfirmAction>
        </OperationColumnActions>
      )
    }
  ];

  return (
    <TemplateListPage<ArchiveRecord>
      embedded
      filter={filter}
      pagination={pagination}
      table={{
        className: 'archive-page__table',
        loading,
        columns,
        dataSource: rows,
        pagination: false,
        search: false,
        options: false,
        tableAlertRender: false,
        scroll: { x: 860 },
        rowDragSort: {
          onChange: (_, { activeRecord, targetRecord }) => onSortChange(activeRecord, targetRecord)
        }
      }}
    />
  );
}
