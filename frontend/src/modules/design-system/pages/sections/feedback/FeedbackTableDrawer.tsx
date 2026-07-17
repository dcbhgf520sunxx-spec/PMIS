import { type Key, useMemo, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import {
  AdminActionDropdown, AdminButton, AdminInput, AdminRangePicker, AdminSelect, AdminSpace,
  AdminTextAction, CompactFilterBar, createListFilterItems, createListSorters,
  DeleteConfirmAction, listSorters, OperationColumnActions, TemplateDrawerTable,
  useTemplateListPageData
} from '../../../../../components/admin';
import { mockWorkOrders, workOrderUsers } from '../../../../work-order/mock';
import type { WorkOrderRecord } from '../../../../work-order/types';
import {
  problemTypeOptions, problemTypeText, renderOverdue, renderUrgency,
  renderWorkOrderStatus, statusOptions, urgencyOptions
} from '../../../../work-order/helpers';

type DrawerTableRecord = WorkOrderRecord;

type DrawerTableFilters = {
  problemDesc: string;
  problemTypes: WorkOrderRecord['problemType'][];
  urgency?: WorkOrderRecord['urgency'];
  status?: WorkOrderRecord['status'];
  isOverdue?: boolean;
  followerId?: string;
  submitterName: string;
  submitTimeRange: unknown[];
  expectedResolveDateRange: unknown[];
};

const defaultDrawerTableFilters: DrawerTableFilters = {
  problemDesc: '',
  problemTypes: [],
  urgency: undefined,
  status: undefined,
  isOverdue: undefined,
  followerId: undefined,
  submitterName: '',
  submitTimeRange: [],
  expectedResolveDateRange: []
};

const listTemplateSorters = createListSorters<WorkOrderRecord>({
  problemDesc: listSorters.text((row) => row.problemDesc),
  problemType: listSorters.text((row) => problemTypeText(row.problemType)),
  followerName: listSorters.text((row) => row.followerName),
  urgency: listSorters.number((row) => row.urgency),
  status: listSorters.number((row) => row.status),
  submitterName: listSorters.text((row) => row.submitterName),
  submitTime: listSorters.date((row) => row.submitTime),
  expectedResolveDate: listSorters.date((row) => row.expectedResolveDate)
});

function toDateText(value: unknown) {
  if (!value) return '';
  if (typeof value === 'object' && 'format' in value && typeof value.format === 'function') {
    return value.format('YYYY-MM-DD');
  }
  return String(value).slice(0, 10);
}

function inDateRange(value: string, range: unknown[]) {
  if (range.length !== 2 || !range[0] || !range[1]) return true;
  const start = toDateText(range[0]);
  const end = toDateText(range[1]);
  const current = value.slice(0, 10);
  return current >= start && current <= end;
}

const drawerTableColumns: ProColumns<DrawerTableRecord>[] = [
  { title: '序号', valueType: 'index', width: 48, fixed: 'left', hideInSetting: true },
  {
    title: '问题描述',
    dataIndex: 'problemDesc',
    width: 320,
    fixed: 'left',
    ellipsis: true,
    sorter: (a, b) => a.problemDesc.localeCompare(b.problemDesc),
    render: (_, record) => (
      <div className="design-system-page__drawer-problem-cell">
        <AdminTextAction className="design-system-page__drawer-table-link" title={record.problemDesc}>
          {record.problemDesc}
        </AdminTextAction>
        {record.isOverdue ? <span className="design-system-page__drawer-problem-tag">{renderOverdue(true)}</span> : null}
      </div>
    )
  },
  {
    title: '问题类型',
    dataIndex: 'problemType',
    width: 100,
    ellipsis: true,
    sorter: (a, b) => problemTypeText(a.problemType).localeCompare(problemTypeText(b.problemType)),
    render: (_, record) => problemTypeText(record.problemType)
  },
  {
    title: '跟进人',
    dataIndex: 'followerName',
    width: 80,
    ellipsis: true,
    sorter: (a, b) => (a.followerName || '').localeCompare(b.followerName || '')
  },
  {
    title: '紧急程度',
    dataIndex: 'urgency',
    width: 80,
    sorter: (a, b) => a.urgency - b.urgency,
    render: (_, record) => renderUrgency(record.urgency)
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 90,
    sorter: (a, b) => a.status - b.status,
    render: (_, record) => renderWorkOrderStatus(record.status)
  },
  {
    title: '提出人',
    dataIndex: 'submitterName',
    width: 80,
    ellipsis: true,
    sorter: (a, b) => a.submitterName.localeCompare(b.submitterName)
  },
  {
    title: '提出时间',
    dataIndex: 'submitTime',
    width: 130,
    sorter: (a, b) => a.submitTime.localeCompare(b.submitTime),
    render: (_, record) => record.submitTime.slice(0, 10)
  },
  { title: '预计完成时间', dataIndex: 'expectedResolveDate', width: 140 },
  { title: '创建人', dataIndex: 'creatorName', width: 80, ellipsis: true },
  { title: '创建时间', dataIndex: 'createdAt', width: 150, ellipsis: true },
  {
    title: '操作',
    valueType: 'option',
    width: 180,
    fixed: 'right',
    render: () => (
      <OperationColumnActions>
        <AdminTextAction className="design-system-page__drawer-table-link">编辑</AdminTextAction>
        <AdminTextAction className="design-system-page__drawer-table-link">状态变更</AdminTextAction>
        <AdminActionDropdown
          items={[
            { key: 'copy', label: '复制' },
            { key: 'delete', label: '删除', danger: true }
          ]}
          onClick={() => undefined}
        />
      </OperationColumnActions>
    )
  }
];

type FeedbackTableDrawerProps = { open: boolean; onClose: () => void };

export function FeedbackTableDrawer({ open, onClose }: FeedbackTableDrawerProps) {
  const [tableDrawerFilterExpanded, setTableDrawerFilterExpanded] = useState(false);
  const [tableDrawerDraftFilters, setTableDrawerDraftFilters] = useState<DrawerTableFilters>(defaultDrawerTableFilters);
  const [tableDrawerAppliedFilters, setTableDrawerAppliedFilters] = useState<DrawerTableFilters>(defaultDrawerTableFilters);
  const [tableDrawerSelectedRowKeys, setTableDrawerSelectedRowKeys] = useState<Key[]>([]);
  const [tableDrawerSelectedRows, setTableDrawerSelectedRows] = useState<DrawerTableRecord[]>([]);

  const tableDrawerFilteredRows = useMemo(() => mockWorkOrders.filter((row) => {
    const matchProblem = tableDrawerAppliedFilters.problemDesc
      ? row.problemDesc.includes(tableDrawerAppliedFilters.problemDesc)
      : true;
    const matchSubmitter = tableDrawerAppliedFilters.submitterName
      ? row.submitterName.includes(tableDrawerAppliedFilters.submitterName)
      : true;
    const matchProblemType = tableDrawerAppliedFilters.problemTypes.length > 0
      ? tableDrawerAppliedFilters.problemTypes.includes(row.problemType)
      : true;
    const matchUrgency = tableDrawerAppliedFilters.urgency !== undefined
      ? row.urgency === tableDrawerAppliedFilters.urgency
      : true;
    const matchStatus = tableDrawerAppliedFilters.status !== undefined
      ? row.status === tableDrawerAppliedFilters.status
      : true;
    const matchOverdue = tableDrawerAppliedFilters.isOverdue !== undefined
      ? row.isOverdue === tableDrawerAppliedFilters.isOverdue
      : true;
    const matchFollower = tableDrawerAppliedFilters.followerId
      ? row.followerId === tableDrawerAppliedFilters.followerId
      : true;
    const matchSubmitTime = inDateRange(row.submitTime, tableDrawerAppliedFilters.submitTimeRange);
    const matchExpectedTime = inDateRange(row.expectedResolveDate, tableDrawerAppliedFilters.expectedResolveDateRange);

    return matchProblem
      && matchSubmitter
      && matchProblemType
      && matchUrgency
      && matchStatus
      && matchOverdue
      && matchFollower
      && matchSubmitTime
      && matchExpectedTime;
  }), [tableDrawerAppliedFilters]);

  const {
    pagedRows: tableDrawerRows,
    pagination: tableDrawerPagination,
    handleTableChange: handleTableDrawerTableChange,
    renderIndex: renderTableDrawerIndex,
    setCurrentPage: setTableDrawerCurrentPage
  } = useTemplateListPageData({
    rows: tableDrawerFilteredRows,
    sorters: listTemplateSorters,
    resetOn: [tableDrawerAppliedFilters]
  });

  const tableDrawerDisplayColumns = drawerTableColumns.map((column, index) => index === 0
    ? {
      ...column,
      valueType: undefined,
      render: (_: unknown, __: DrawerTableRecord, rowIndex: number) => renderTableDrawerIndex(rowIndex)
    }
    : column);


  const tableDrawerFilterItems = useMemo(() => createListFilterItems([
    {
      key: 'problemDesc',
      label: '问题描述',
      node: (
        <AdminInput
          size="small"
          value={tableDrawerDraftFilters.problemDesc}
          placeholder="请输入"
          onChange={(event) => setTableDrawerDraftFilters((prev) => ({ ...prev, problemDesc: event.target.value }))}
          onPressEnter={() => {
            setTableDrawerAppliedFilters(tableDrawerDraftFilters);
            setTableDrawerCurrentPage(1);
            setTableDrawerSelectedRowKeys([]);
            setTableDrawerSelectedRows([]);
          }}
        />
      )
    },
    {
      key: 'problemType',
      label: '问题类型',
      node: (
        <AdminSelect
          size="small"
          mode="multiple"
          maxTagCount="responsive"
          allowClear
          optionFilterProp="label"
          value={tableDrawerDraftFilters.problemTypes}
          options={problemTypeOptions}
          placeholder="全部"
          onChange={(value) => setTableDrawerDraftFilters((prev) => ({ ...prev, problemTypes: value }))}
        />
      )
    },
    {
      key: 'urgency',
      label: '紧急程度',
      node: (
        <AdminSelect
          size="small"
          allowClear
          optionFilterProp="label"
          value={tableDrawerDraftFilters.urgency}
          options={urgencyOptions}
          placeholder="全部"
          onChange={(value) => setTableDrawerDraftFilters((prev) => ({ ...prev, urgency: value }))}
        />
      )
    },
    {
      key: 'status',
      label: '状态',
      node: (
        <AdminSelect
          size="small"
          allowClear
          optionFilterProp="label"
          value={tableDrawerDraftFilters.status}
          options={statusOptions}
          placeholder="全部"
          onChange={(value) => setTableDrawerDraftFilters((prev) => ({ ...prev, status: value }))}
        />
      )
    },
    {
      key: 'isOverdue',
      label: '逾期',
      node: (
        <AdminSelect
          size="small"
          allowClear
          optionFilterProp="label"
          value={tableDrawerDraftFilters.isOverdue}
          options={[
            { label: '未逾期', value: false },
            { label: '逾期', value: true }
          ]}
          placeholder="全部"
          onChange={(value) => setTableDrawerDraftFilters((prev) => ({ ...prev, isOverdue: value }))}
        />
      )
    },
    {
      key: 'followerId',
      label: '跟进人',
      node: (
        <AdminSelect
          size="small"
          allowClear
          optionFilterProp="label"
          value={tableDrawerDraftFilters.followerId}
          options={workOrderUsers}
          placeholder="全部"
          onChange={(value) => setTableDrawerDraftFilters((prev) => ({ ...prev, followerId: value }))}
        />
      )
    },
    {
      key: 'submitterName',
      label: '提出人',
      node: (
        <AdminInput
          size="small"
          value={tableDrawerDraftFilters.submitterName}
          placeholder="请输入"
          onChange={(event) => setTableDrawerDraftFilters((prev) => ({ ...prev, submitterName: event.target.value }))}
          onPressEnter={() => {
            setTableDrawerAppliedFilters(tableDrawerDraftFilters);
            setTableDrawerCurrentPage(1);
            setTableDrawerSelectedRowKeys([]);
            setTableDrawerSelectedRows([]);
          }}
        />
      )
    },
    {
      key: 'submitTimeRange',
      label: '提出时间',
      wide: true,
      node: (
        <AdminRangePicker
          size="small"
          value={tableDrawerDraftFilters.submitTimeRange as never}
          placeholder={['开始日期', '结束日期']}
          onChange={(value) => setTableDrawerDraftFilters((prev) => ({ ...prev, submitTimeRange: value || [] }))}
        />
      )
    },
    {
      key: 'expectedResolveDateRange',
      label: '预计完成时间',
      wide: true,
      node: (
        <AdminRangePicker
          size="small"
          value={tableDrawerDraftFilters.expectedResolveDateRange as never}
          placeholder={['开始日期', '结束日期']}
          onChange={(value) => setTableDrawerDraftFilters((prev) => ({ ...prev, expectedResolveDateRange: value || [] }))}
        />
      )
    }
  ]), [setTableDrawerCurrentPage, tableDrawerDraftFilters]);

  return (
      <TemplateDrawerTable<DrawerTableRecord>
        title="表格抽屉"
        width="calc(100vw - 180px)"
        open={open}
        onClose={onClose}
        description="表格抽屉用于在不离开当前页面的情况下查看关联数据，必须包含查询、表格、页码和操作。"
        list={{
          mode: 'batch',
          filter: (
            <CompactFilterBar
              items={tableDrawerFilterItems}
              expanded={tableDrawerFilterExpanded}
              visibleCount={4}
              onExpandChange={setTableDrawerFilterExpanded}
              onSearch={() => {
                setTableDrawerAppliedFilters(tableDrawerDraftFilters);
                setTableDrawerCurrentPage(1);
                setTableDrawerSelectedRowKeys([]);
                setTableDrawerSelectedRows([]);
              }}
              onReset={() => {
                setTableDrawerDraftFilters(defaultDrawerTableFilters);
                setTableDrawerAppliedFilters(defaultDrawerTableFilters);
                setTableDrawerCurrentPage(1);
                setTableDrawerSelectedRowKeys([]);
                setTableDrawerSelectedRows([]);
              }}
            />
          ),
          table: {
            columns: tableDrawerDisplayColumns,
            dataSource: tableDrawerRows,
            preferenceKey: 'design-system:drawer-table',
            pagination: false,
            rowSelection: {
              selectedRowKeys: tableDrawerSelectedRowKeys,
              onChange: (keys, rows) => {
                setTableDrawerSelectedRowKeys(keys);
                setTableDrawerSelectedRows(rows);
              }
            },
            search: false,
            scroll: { x: 1600 },
            tableAlertRender: false,
            onChange: handleTableDrawerTableChange
          },
          batch: {
            selectedCount: tableDrawerSelectedRowKeys.length,
            actions: (
              <AdminSpace size={8}>
                <AdminButton size="small">批量指派</AdminButton>
                <AdminButton size="small" disabled={tableDrawerSelectedRows.length === 0}>批量状态变更</AdminButton>
                <DeleteConfirmAction
                  size="small"
                  disabled={tableDrawerSelectedRows.length === 0}
                  entityName="选中的"
                  targetName={`${tableDrawerSelectedRows.length} 项工单`}
                  title="确认批量删除工单"
                  successMessage={`已删除 ${tableDrawerSelectedRows.length} 项工单`}
                  onConfirm={() => {
                    setTableDrawerSelectedRowKeys([]);
                    setTableDrawerSelectedRows([]);
                  }}
                >
                  批量删除
                </DeleteConfirmAction>
              </AdminSpace>
            )
          },
          pagination: {
            ...tableDrawerPagination,
            onChange: (page, pageSize) => {
              tableDrawerPagination.onChange(page, pageSize);
              setTableDrawerSelectedRowKeys([]);
              setTableDrawerSelectedRows([]);
            },
            onShowSizeChange: (page, pageSize) => {
              tableDrawerPagination.onShowSizeChange(page, pageSize);
              setTableDrawerSelectedRowKeys([]);
              setTableDrawerSelectedRows([]);
            }
          }
        }}
      />
  );
}
