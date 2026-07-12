import { useEffect, useMemo, useState } from 'react';
import type { Key } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { useNavigate } from 'react-router-dom';
import {
  ActionBar,
  AdminButton,
  AdminInput,
  AdminRangePicker,
  AdminSelect,
  AdminSearchDropdown,
  AdminText,
  AdminTextAction,
  AdminModal,
  CompactFilterBar,
  DeleteConfirmAction,
  createListFilterItems,
  createListSorters,
  DetailLinkCell,
  InfoGrid,
  listSorters,
  OperationColumnActions,
  TemplateListPage,
  useCommittedFilters,
  useTemplateListPageData,
  ViewTabs
} from '../../../components/admin';
import { WorkOrderStatusChangeAction } from '../../work-order/components/WorkOrderStatusChangeAction';
import { mockWorkOrders, workOrderUsers } from '../../work-order/mock';
import type { WorkOrderRecord } from '../../work-order/types';
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
import { statusTransitions } from '../../work-order/pages/workOrderList.constants';
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

const workOrderTemplateSorters = createListSorters<WorkOrderRecord>({
  problemDesc: listSorters.text((row) => row.problemDesc),
  problemType: listSorters.text((row) => problemTypeText(row.problemType)),
  followerName: listSorters.text((row) => row.followerName),
  urgency: listSorters.number((row) => row.urgency),
  status: listSorters.number((row) => row.status),
  submitterName: listSorters.text((row) => row.submitterName),
  submitTime: listSorters.date((row) => row.submitTime),
  expectedResolveDate: listSorters.date((row) => row.expectedResolveDate),
  creatorName: listSorters.text((row) => row.creatorName),
  createdAt: listSorters.date((row) => row.createdAt)
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

export function WorkOrderTemplatePage() {
  const navigate = useNavigate();
  const [viewKey, setViewKey] = useState<ViewKey>('all');
  const { draftFilters, appliedFilters, revision: filterRevision, setDraftFilters, commitFilters, resetFilters } = useCommittedFilters(defaultFilters);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<WorkOrderRecord[]>([]);
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
    pagination,
    handleTableChange,
    renderIndex
  } = useTemplateListPageData({ rows: filteredRows, sorters: workOrderTemplateSorters, resetOn: [filterRevision, viewKey] });

  const filterItems = useMemo(() => {
    return createListFilterItems([
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
    ]);
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
          <WorkOrderStatusChangeAction
            variant="text"
            workOrder={record}
            statusOptions={statusOptions.filter((item) => statusTransitions[record.status].includes(item.value))}
            onConfirm={() => undefined}
          >
            状态变更
          </WorkOrderStatusChangeAction>
          <AdminTextAction onClick={() => navigate(`/samples/work-order/${record.id}/copy`)}>复制</AdminTextAction>
          <DeleteConfirmAction
            variant="text"
            entityName="工单"
            targetName={record.code}
            successMessage="工单已删除"
            onConfirm={() => undefined}
          >
            删除
          </DeleteConfirmAction>
        </OperationColumnActions>
      )
    }
  ], [navigate, renderIndex, sortState]);

  const sameStatus = selectedRows.length === 0 || selectedRows.every((item) => item.status === selectedRows[0].status);
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
          showCounts
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
          <AdminButton type="primary" onClick={() => navigate('/samples/work-order/new')}>新增工单</AdminButton>
        </ActionBar>
      }
      filter={(
        <CompactFilterBar
          items={filterItems}
          visibleCount={4}
          onSearch={() => {
            commitFilters();
            setSelectedRowKeys([]);
            setSelectedRows([]);
          }}
          onReset={() => {
            resetFilters();
            setSelectedRowKeys([]);
            setSelectedRows([]);
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
            <AdminButton size="small" disabled={selectedRows.length === 0} onClick={() => setBatchStatusOpen(true)}>
              批量状态变更
            </AdminButton>
            <DeleteConfirmAction
              size="small"
              disabled={selectedRows.length === 0}
              entityName="选中的"
              targetName={`${selectedRows.length} 项工单`}
              title="确认批量删除工单"
              successMessage={`已删除 ${selectedRows.length} 项工单`}
              onConfirm={() => {
                setSelectedRowKeys([]);
                setSelectedRows([]);
              }}
            >
              批量删除
            </DeleteConfirmAction>
          </>
        )
      }}
      pagination={pagination}
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
          <AdminText type="warning">选中的工单状态不一致，无法批量变更。</AdminText>
        )}
      </AdminModal>

    </>
  );
}
