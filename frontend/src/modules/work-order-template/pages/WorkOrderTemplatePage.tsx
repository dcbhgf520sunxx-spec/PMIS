import { useEffect, useMemo, useState } from 'react';
import type { Key } from 'react';
import { Button, Typography } from 'antd';
import type { ProColumns } from '@ant-design/pro-components';
import { useNavigate } from 'react-router-dom';
import {
  ActionBar,
  AdminActionDropdown,
  AdminInput,
  AdminRangePicker,
  AdminSelect,
  AdminSearchDropdown,
  AdminTextAction,
  AdminModal,
  CompactFilterBar,
  ConfirmAction,
  DetailLinkCell,
  InfoGrid,
  OperationColumnActions,
  TemplateListPage,
  useCommittedFilters,
  useTemplateListPageData,
  ViewTabs
} from '../../../components/admin';
import { StatusChangeModal } from '../../work-order/components/StatusChangeModal';
import { mockWorkOrders, workOrderUsers } from '../../work-order/mock';
import type { WorkOrderRecord, WorkOrderStatus } from '../../work-order/types';
import {
  problemTypeOptions,
  problemTypeText,
  renderOverdue,
  renderUrgency,
  renderWorkOrderStatus,
  statusOptions,
  statusText,
  urgencyOptions
} from '../../work-order/helpers';
import '../../work-order/pages/WorkOrderListPage.css';

type ViewKey = 'all' | 'mine';

type WorkOrderFilters = {
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

const defaultFilters: WorkOrderFilters = {
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

const workOrderTemplateSorters: Record<string, (a: WorkOrderRecord, b: WorkOrderRecord) => number> = {
  problemDesc: (a, b) => a.problemDesc.localeCompare(b.problemDesc),
  problemType: (a, b) => problemTypeText(a.problemType).localeCompare(problemTypeText(b.problemType)),
  followerName: (a, b) => (a.followerName || '').localeCompare(b.followerName || ''),
  urgency: (a, b) => a.urgency - b.urgency,
  status: (a, b) => a.status - b.status,
  submitterName: (a, b) => a.submitterName.localeCompare(b.submitterName),
  submitTime: (a, b) => a.submitTime.localeCompare(b.submitTime),
  expectedResolveDate: (a, b) => a.expectedResolveDate.localeCompare(b.expectedResolveDate),
  creatorName: (a, b) => a.creatorName.localeCompare(b.creatorName),
  createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt)
};

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

export function WorkOrderTemplatePage() {
  const navigate = useNavigate();
  const [viewKey, setViewKey] = useState<ViewKey>('all');
  const { draftFilters, appliedFilters, setDraftFilters, commitFilters, resetFilters } = useCommittedFilters(defaultFilters);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<WorkOrderRecord[]>([]);
  const [activeOrder, setActiveOrder] = useState<WorkOrderRecord | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<WorkOrderRecord | null>(null);
  const [targetStatus, setTargetStatus] = useState<WorkOrderStatus | undefined>();
  const [batchStatusOpen, setBatchStatusOpen] = useState(false);

  const visibleRows = useMemo(() => {
    if (viewKey === 'mine') {
      return mockWorkOrders.filter((item) => item.followerId === '2');
    }
    return mockWorkOrders;
  }, [viewKey]);

  const filteredRows = useMemo(() => visibleRows.filter((row) => {
    const matchProblem = appliedFilters.problemDesc ? row.problemDesc.includes(appliedFilters.problemDesc) : true;
    const matchSubmitter = appliedFilters.submitterName ? row.submitterName.includes(appliedFilters.submitterName) : true;
    const matchProblemType = appliedFilters.problemTypes.length > 0
      ? appliedFilters.problemTypes.includes(row.problemType)
      : true;
    const matchUrgency = appliedFilters.urgency !== undefined ? row.urgency === appliedFilters.urgency : true;
    const matchStatus = appliedFilters.status !== undefined ? row.status === appliedFilters.status : true;
    const matchOverdue = appliedFilters.isOverdue !== undefined ? row.isOverdue === appliedFilters.isOverdue : true;
    const matchFollower = viewKey === 'all' && appliedFilters.followerId ? row.followerId === appliedFilters.followerId : true;
    const matchSubmitTime = inDateRange(row.submitTime, appliedFilters.submitTimeRange);
    const matchExpectedTime = inDateRange(row.expectedResolveDate, appliedFilters.expectedResolveDateRange);
    return matchProblem
      && matchSubmitter
      && matchProblemType
      && matchUrgency
      && matchStatus
      && matchOverdue
      && matchFollower
      && matchSubmitTime
      && matchExpectedTime;
  }), [appliedFilters, viewKey, visibleRows]);

  const {
    currentPage,
    pageSize,
    pagedRows,
    sortState,
    total,
    setCurrentPage,
    setPageSize,
    handleTableChange,
    renderIndex
  } = useTemplateListPageData({ rows: filteredRows, sorters: workOrderTemplateSorters });

  const filterItems = useMemo(() => {
    const items = [
      {
        key: 'problemDesc',
        label: '问题描述',
        node: (
          <AdminInput
            size="small"
            value={draftFilters.problemDesc}
            placeholder="请输入"
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, problemDesc: event.target.value }))}
            onPressEnter={() => {
              commitFilters();
              setSelectedRowKeys([]);
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
            value={draftFilters.problemTypes}
            options={problemTypeOptions}
            placeholder="全部"
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, problemTypes: value }))}
          />
        )
      },
      {
        key: 'urgency',
        label: '紧急程度',
        node: (
          <AdminSelect
            size="small"
            value={draftFilters.urgency}
            options={urgencyOptions}
            placeholder="全部"
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, urgency: value }))}
          />
        )
      },
      {
        key: 'status',
        label: '状态',
        node: (
          <AdminSelect
            size="small"
            value={draftFilters.status}
            options={statusOptions}
            placeholder="全部"
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, status: value }))}
          />
        )
      },
      {
        key: 'isOverdue',
        label: '逾期',
        node: (
          <AdminSelect
            size="small"
            value={draftFilters.isOverdue}
            options={[
              { label: '未逾期', value: false },
              { label: '逾期', value: true }
            ]}
            placeholder="全部"
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, isOverdue: value }))}
          />
        )
      },
      {
        key: 'followerId',
        label: '跟进人',
        hidden: viewKey !== 'all',
        node: (
          <AdminSelect
            size="small"
            value={draftFilters.followerId}
            options={workOrderUsers}
            placeholder="全部"
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, followerId: value }))}
          />
        )
      },
      {
        key: 'submitterName',
        label: '提出人',
        node: (
          <AdminInput
            size="small"
            value={draftFilters.submitterName}
            placeholder="请输入"
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, submitterName: event.target.value }))}
            onPressEnter={() => {
              commitFilters();
              setSelectedRowKeys([]);
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
            value={draftFilters.submitTimeRange as never}
            placeholder={['开始日期', '结束日期']}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, submitTimeRange: value || [] }))}
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
            value={draftFilters.expectedResolveDateRange as never}
            placeholder={['开始日期', '结束日期']}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, expectedResolveDateRange: value || [] }))}
          />
        )
      }
    ];
    return items.filter((item) => !('hidden' in item && item.hidden));
  }, [draftFilters, viewKey]);

  const columns = useMemo<ProColumns<WorkOrderRecord>[]>(() => [
    {
      title: '序号',
      width: 48,
      fixed: 'left',
      hideInSetting: true,
      search: false,
      render: (_, __, index) => renderIndex(index)
    },
    {
      title: '问题描述',
      dataIndex: 'problemDesc',
      width: 320,
      fixed: 'left',
      ellipsis: true,
      sorter: true,
      sortOrder: sortState.field === 'problemDesc' ? sortState.order : null,
      render: (_, record) => (
        <div className="work-order-problem-cell">
          <DetailLinkCell className="work-order-problem-cell__text" title={record.problemDesc} onClick={() => navigate(`/samples/work-order/${record.id}`)}>
            {record.problemDesc}
          </DetailLinkCell>
          {record.isOverdue ? <span className="work-order-problem-cell__tag">{renderOverdue(true)}</span> : null}
        </div>
      )
    },
    {
      title: '问题类型',
      dataIndex: 'problemType',
      width: 100,
      sorter: true,
      sortOrder: sortState.field === 'problemType' ? sortState.order : null,
      render: (_, record) => problemTypeText(record.problemType)
    },
    {
      title: '跟进人',
      dataIndex: 'followerName',
      width: 80,
      sorter: true,
      sortOrder: sortState.field === 'followerName' ? sortState.order : null
    },
    {
      title: '紧急程度',
      dataIndex: 'urgency',
      width: 96,
      sorter: true,
      sortOrder: sortState.field === 'urgency' ? sortState.order : null,
      render: (_, record) => renderUrgency(record.urgency)
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      sorter: true,
      sortOrder: sortState.field === 'status' ? sortState.order : null,
      render: (_, record) => renderWorkOrderStatus(record.status)
    },
    {
      title: '提出人',
      dataIndex: 'submitterName',
      width: 80,
      sorter: true,
      sortOrder: sortState.field === 'submitterName' ? sortState.order : null
    },
    {
      title: '提出时间',
      dataIndex: 'submitTime',
      width: 130,
      sorter: true,
      sortOrder: sortState.field === 'submitTime' ? sortState.order : null,
      render: (_, record) => record.submitTime.slice(0, 10)
    },
    {
      title: '预计完成时间',
      dataIndex: 'expectedResolveDate',
      width: 130,
      sorter: true,
      sortOrder: sortState.field === 'expectedResolveDate' ? sortState.order : null
    },
    {
      title: '创建人',
      dataIndex: 'creatorName',
      width: 80,
      sorter: true,
      sortOrder: sortState.field === 'creatorName' ? sortState.order : null
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      sorter: true,
      sortOrder: sortState.field === 'createdAt' ? sortState.order : null
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <OperationColumnActions>
          <AdminTextAction onClick={() => navigate(`/samples/work-order/${record.id}/edit`)}>编辑</AdminTextAction>
          <AdminTextAction
            onClick={() => {
              setTargetStatus(undefined);
              setActiveOrder(record);
            }}
          >
            状态变更
          </AdminTextAction>
          <AdminActionDropdown
            items={[
              { key: 'copy', label: '复制' },
              { key: 'delete', label: '删除', danger: true }
            ]}
            onClick={(key) => {
              if (key === 'copy') navigate(`/samples/work-order/${record.id}/copy`);
              if (key === 'delete') setDeleteOrder(record);
            }}
          />
        </OperationColumnActions>
      )
    }
  ], [navigate, renderIndex, sortState]);

  const sameStatus = selectedRows.length === 0 || selectedRows.every((item) => item.status === selectedRows[0].status);
  const availableNextStatuses = statusOptions.filter((item) => activeOrder ? item.value > activeOrder.status : false);
  const handleViewChange = (nextViewKey: ViewKey) => {
    setViewKey(nextViewKey);
    setSelectedRowKeys([]);
    setSelectedRows([]);
  };

  return (
    <>
    <TemplateListPage<WorkOrderRecord>
      mode="batch"
      title="运维工单样板"
      titleExtra={
        <ViewTabs<ViewKey>
          value={viewKey}
          onChange={handleViewChange}
          items={[
            { label: '全部', value: 'all', count: mockWorkOrders.length },
            { label: '我的工单', value: 'mine', count: mockWorkOrders.filter((item) => item.followerId === '2').length }
          ]}
        />
      }
      actions={
        <ActionBar>
          <Button type="primary" onClick={() => navigate('/samples/work-order/new')}>新增工单</Button>
        </ActionBar>
      }
      filter={(
        <CompactFilterBar
          items={filterItems}
          expanded={filterExpanded}
          visibleCount={4}
          onExpandChange={setFilterExpanded}
          onSearch={() => {
            commitFilters();
            setSelectedRowKeys([]);
            setSelectedRows([]);
            setCurrentPage(1);
          }}
          onReset={() => {
            resetFilters();
            setSelectedRowKeys([]);
            setSelectedRows([]);
            setCurrentPage(1);
          }}
        />
      )}
      table={{
        columns,
        dataSource: pagedRows,
        pagination: false,
        search: false,
        rowSelection: {
          selectedRowKeys,
          onChange: (keys, rows) => {
            setSelectedRowKeys(keys);
            setSelectedRows(rows);
          }
        },
        onChange: handleTableChange,
        tableAlertRender: false,
        scroll: { x: 1580 }
      }}
      scrollYDeps={[filterExpanded, viewKey, total, currentPage, pageSize, pagedRows.length]}
      batch={{
        selectedCount: selectedRows.length,
        actions: (
          <>
            <AdminSearchDropdown
              disabled={selectedRows.length === 0}
              placeholder="搜索跟进人"
              options={workOrderUsers.map((user) => ({
                value: user.value,
                label: user.label,
                searchText: user.label
              }))}
              onSelect={() => {
                setSelectedRowKeys([]);
                setSelectedRows([]);
              }}
            >
              批量指派
            </AdminSearchDropdown>
            <Button size="small" disabled={selectedRows.length === 0} onClick={() => setBatchStatusOpen(true)}>
              批量状态变更
            </Button>
            <ConfirmAction
              danger
              size="small"
              disabled={selectedRows.length === 0}
              title="确认批量删除"
              description={`删除后选中的 ${selectedRows.length} 项工单将无法恢复，确认删除？`}
              successMessage={`已删除 ${selectedRows.length} 项工单`}
              onConfirm={() => {
                setSelectedRowKeys([]);
                setSelectedRows([]);
              }}
            >
              批量删除
            </ConfirmAction>
          </>
        )
      }}
      pagination={{
        current: currentPage,
        pageSize,
        total,
        onChange: (page, size) => {
          setCurrentPage(page);
          setPageSize(size);
        },
        onShowSizeChange: (_, size) => {
          setCurrentPage(1);
          setPageSize(size);
        }
      }}
    />

      <AdminModal
        title="批量状态变更"
        open={batchStatusOpen}
        size="small"
        onCancel={() => setBatchStatusOpen(false)}
        onOk={() => setBatchStatusOpen(false)}
        okButtonProps={{ disabled: selectedRows.length === 0 || !sameStatus }}
      >
        {sameStatus ? (
          <InfoGrid
            columns={2}
            items={[
              { label: '选中数量', value: `${selectedRows.length} 项` },
              { label: '当前状态', value: selectedRows[0] ? statusText(selectedRows[0].status) : '-' },
              { label: '目标状态', value: '处理中 / 已完成 / 已关闭' },
              { label: '校验规则', value: '仅允许同状态批量流转' }
            ]}
          />
        ) : (
          <Typography.Text type="warning">选中的工单状态不一致，无法批量变更。</Typography.Text>
        )}
      </AdminModal>

      <AdminModal
        title="确认删除"
        open={Boolean(deleteOrder)}
        size="small"
        okText="删除"
        okButtonProps={{ danger: true }}
        onCancel={() => setDeleteOrder(null)}
        onOk={() => setDeleteOrder(null)}
      >
        <div className="work-order-list-page__delete-confirm">
          <div>删除后该运维工单及其处理记录将无法恢复，确认删除？</div>
        </div>
      </AdminModal>

      <StatusChangeModal
        open={Boolean(activeOrder)}
        workOrder={activeOrder}
        targetStatus={targetStatus}
        statusOptions={availableNextStatuses}
        onTargetStatusChange={setTargetStatus}
        onCancel={() => {
          setActiveOrder(null);
          setTargetStatus(undefined);
        }}
        onConfirm={() => {
          setActiveOrder(null);
          setTargetStatus(undefined);
        }}
      />
    </>
  );
}
