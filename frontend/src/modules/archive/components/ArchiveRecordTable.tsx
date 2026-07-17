import { type DragEvent, type ReactNode, useState } from 'react';
import { HolderOutlined } from '@ant-design/icons';
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
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (record: ArchiveRecord) => void;
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
  onDragStart,
  onDragEnd,
  onDrop
}: ArchiveRecordTableProps) {
  const [draggingRowId, setDraggingRowId] = useState<string>();
  const [dragOverRowId, setDragOverRowId] = useState<string>();

  const getDropPosition = (recordId: string) => {
    if (!draggingRowId || draggingRowId === recordId) return '';

    const draggingIndex = rows.findIndex((item) => item.id === draggingRowId);
    const targetIndex = rows.findIndex((item) => item.id === recordId);
    if (draggingIndex < 0 || targetIndex < 0) return '';

    return draggingIndex < targetIndex ? 'is-drag-over-after' : 'is-drag-over-before';
  };

  const setRowDragPreview = (event: DragEvent<HTMLElement>) => {
    const row = event.currentTarget.closest('tr');
    if (!row || !event.dataTransfer) return;

    const preview = row.cloneNode(true) as HTMLElement;
    const rowRect = row.getBoundingClientRect();
    const cells = Array.from(row.children) as HTMLElement[];
    const previewCells = Array.from(preview.children) as HTMLElement[];

    preview.className = 'archive-page__drag-preview';
    preview.style.width = `${rowRect.width}px`;
    previewCells.forEach((cell, index) => {
      const width = cells[index]?.getBoundingClientRect().width;
      if (width) cell.style.width = `${width}px`;
    });

    document.body.appendChild(preview);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setDragImage(preview, 28, Math.min(24, rowRect.height / 2));
    window.setTimeout(() => {
      preview.remove();
    });
  };

  const columns: ProColumns<ArchiveRecord>[] = [
    {
      title: '',
      width: 42,
      search: false,
      render: (_, record) => (
        <HolderOutlined
          className="archive-page__drag-handle"
          draggable
          onDragStart={(event) => {
            setRowDragPreview(event);
            setDraggingRowId(record.id);
            onDragStart(record.id);
          }}
          onDragEnd={() => {
            setDraggingRowId(undefined);
            setDragOverRowId(undefined);
            onDragEnd();
          }}
        />
      )
    },
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
        onRow: (record) => ({
          className: [
            draggingRowId === record.id ? 'is-dragging' : '',
            dragOverRowId === record.id && draggingRowId !== record.id ? 'is-drag-over' : '',
            dragOverRowId === record.id ? getDropPosition(record.id) : ''
          ].filter(Boolean).join(' '),
          draggable: false,
          onDragEnter: () => {
            if (draggingRowId && draggingRowId !== record.id) setDragOverRowId(record.id);
          },
          onDragOver: (event) => {
            event.preventDefault();
            if (draggingRowId && draggingRowId !== record.id) setDragOverRowId(record.id);
          },
          onDragLeave: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverRowId(undefined);
          },
          onDrop: () => {
            setDraggingRowId(undefined);
            setDragOverRowId(undefined);
            onDrop(record);
          }
        })}
      }
    />
  );
}
