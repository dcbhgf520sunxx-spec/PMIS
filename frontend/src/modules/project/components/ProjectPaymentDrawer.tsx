import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { AdminTextAction, DeleteConfirmAction, OperationColumnActions, TemplateDrawerTable, useTemplateListPageData } from '../../../components/admin';
import { deleteProjectPayment, getProjectPayments } from '../../../api/projectApi';
import type { ProjectPaymentRecord, ProjectPaymentStage } from '../types';

type ProjectPaymentDrawerProps = {
  open: boolean;
  projectId: string;
  stage?: ProjectPaymentStage;
  revision: number;
  onClose: () => void;
  onEdit: (payment: ProjectPaymentRecord) => void;
  onChanged: () => void;
};

const money = (value: number) => value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ProjectPaymentDrawer({ open, projectId, stage, revision, onClose, onEdit, onChanged }: ProjectPaymentDrawerProps) {
  const [rows, setRows] = useState<ProjectPaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const list = useTemplateListPageData({ rows, defaultPageSize: 10, sorters: {
    paymentMonth: (a, b) => a.paymentMonth.localeCompare(b.paymentMonth),
    paymentAmount: (a, b) => a.paymentAmount - b.paymentAmount,
    handlerName: (a, b) => a.handlerName.localeCompare(b.handlerName, 'zh-CN'),
    remark: (a, b) => a.remark.localeCompare(b.remark, 'zh-CN'),
    creatorName: (a, b) => a.creatorName.localeCompare(b.creatorName, 'zh-CN'),
    createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
  } });

  const load = useCallback(() => {
    if (!open || !stage) return;
    setLoading(true);
    setError('');
    getProjectPayments(projectId, stage.id).then(setRows).catch((loadError) => setError(loadError instanceof Error ? loadError.message : '加载失败')).finally(() => setLoading(false));
  }, [open, projectId, stage]);

  useEffect(load, [load, revision]);

  const columns = useMemo<ProColumns<ProjectPaymentRecord>[]>(() => [
    { title: '付款时间', dataIndex: 'paymentMonth', width: 120, fixed: 'left', sorter: true },
    { title: '本次付款金额（元）', dataIndex: 'paymentAmount', width: 150, sorter: true, render: (_, record) => money(record.paymentAmount) },
    { title: '经办人', dataIndex: 'handlerName', width: 130, sorter: true },
    { title: '备注', dataIndex: 'remark', width: 240, sorter: true },
    { title: '登记人', dataIndex: 'creatorName', width: 130, sorter: true },
    { title: '登记时间', dataIndex: 'createdAt', width: 180, sorter: true },
    {
      title: '操作', valueType: 'option', width: 130, fixed: 'right',
      render: (_, record) => (
        <OperationColumnActions>
          <AdminTextAction onClick={() => onEdit(record)}>编辑</AdminTextAction>
          <DeleteConfirmAction
            variant="text"
            entityName="付款记录"
            targetName={`${record.paymentMonth} ${money(record.paymentAmount)}`}
            successMessage="付款记录已删除"
            onConfirm={async () => { await deleteProjectPayment(projectId, record.id); load(); onChanged(); }}
          >删除</DeleteConfirmAction>
        </OperationColumnActions>
      ),
    },
  ], [load, onChanged, onEdit, projectId]);

  return (
    <TemplateDrawerTable<ProjectPaymentRecord>
      title={`付款明细：${stage?.stageName || ''}`}
      width="calc(100vw - 220px)"
      open={open}
      onClose={onClose}
      description={stage ? `计划金额（元） ${money(stage.plannedAmount)}，已付金额（元） ${money(stage.paidAmount)}，待付金额（元） ${money(stage.unpaidAmount)}` : undefined}
      list={{
        error,
        onRetry: load,
        table: { columns, dataSource: list.pagedRows, loading, preferenceKey: 'project:payment-records', pagination: false, search: false, tableAlertRender: false, scroll: { x: 1080 }, onChange: list.handleTableChange },
        pagination: list.pagination,
      }}
    />
  );
}
