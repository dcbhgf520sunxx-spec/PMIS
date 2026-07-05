import { useEffect, useMemo, useState } from 'react';
import type { Key } from 'react';
import { message } from 'antd';
import type { ProColumns } from '@ant-design/pro-components';
import { useNavigate } from 'react-router-dom';
import {
  ActionBar,
  AdminActionDropdown,
  AdminAlert,
  AdminButton,
  AdminInput,
  AdminRangePicker,
  AdminSelect,
  AdminSearchDropdown,
  AdminTextAction,
  AdminModal,
  CompactFilterBar,
  DeleteConfirmAction,
  DetailLinkCell,
  OperationColumnActions,
  TemplateListPage,
  useCommittedFilters,
  useTemplateListPageData,
  ViewTabs
} from '../../../components/admin';
import { StatusChangeModal } from '../components/StatusChangeModal';
import { getUserOptions } from '../../../api/userApi';
import { getArchiveOptionsByTypeName } from '../../../api/archiveApi';
import { batchAssignWorkOrders, deleteWorkOrder, getWorkOrderList, updateWorkOrderStatus } from '../../../api/workOrderApi';
import { useAuthStore } from '../../../stores/authStore';
import { richTextToSummary } from '../../../utils/richText';
import type { WorkOrderRecord, WorkOrderStatus } from '../types';
import {
  problemTypeOptions,
  problemTypeText,
  renderOverdue,
  renderUrgency,
  renderWorkOrderStatus,
  statusOptions,
  statusText,
  urgencyOptions
} from '../helpers';
import './WorkOrderListPage.css';

type ViewKey = 'all' | 'mine';

type WorkOrderFilters = {
  problemDesc: string;
  systemId?: string;
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
  systemId: undefined,
  problemTypes: [],
  urgency: undefined,
  status: undefined,
  isOverdue: undefined,
  followerId: undefined,
  submitterName: '',
  submitTimeRange: [],
  expectedResolveDateRange: []
};

const workOrderSorters: Record<string, (a: WorkOrderRecord, b: WorkOrderRecord) => number> = {
  problemDesc: (a, b) => a.problemDesc.localeCompare(b.problemDesc),
  systemName: (a, b) => a.systemName.localeCompare(b.systemName),
  problemType: (a, b) => problemTypeText(a.problemType, a.problemTypeName).localeCompare(problemTypeText(b.problemType, b.problemTypeName)),
  followerId: (a, b) => (a.followerName || '').localeCompare(b.followerName || ''),
  urgency: (a, b) => a.urgency - b.urgency,
  status: (a, b) => a.status - b.status,
  submitterName: (a, b) => a.submitterName.localeCompare(b.submitterName),
  submitTime: (a, b) => a.submitTime.localeCompare(b.submitTime),
  expectedResolveDate: (a, b) => a.expectedResolveDate.localeCompare(b.expectedResolveDate),
  creatorName: (a, b) => a.creatorName.localeCompare(b.creatorName),
  createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt)
};

const statusTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  0: [1, 3],
  1: [2, 3],
  2: [3],
  3: [0, 1, 2]
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

export function WorkOrderListPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const currentFollowerId = currentUser ? String(currentUser.id) : '';
  const [viewKey, setViewKey] = useState<ViewKey>('mine');
  const { draftFilters, appliedFilters, setDraftFilters, commitFilters, resetFilters } = useCommittedFilters(defaultFilters);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [activeOrder, setActiveOrder] = useState<WorkOrderRecord | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<WorkOrderRecord | null>(null);
  const [targetStatus, setTargetStatus] = useState<WorkOrderStatus | undefined>();
  const [batchTargetStatus, setBatchTargetStatus] = useState<WorkOrderStatus | undefined>();
  const [batchStatusOpen, setBatchStatusOpen] = useState(false);
  const [batchAssignTarget, setBatchAssignTarget] = useState<string>();
  const [batchAssignSubmitting, setBatchAssignSubmitting] = useState(false);
  const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);
  const [userOptions, setUserOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [systemOptions, setSystemOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [problemTypeOptions, setProblemTypeOptions] = useState<Array<{ label: string; value: string }>>([]);

  const loadWorkOrders = async () => {
    const result = await getWorkOrderList({ pageSize: 1000 });
    setWorkOrders(result.list);
  };

  useEffect(() => {
    loadWorkOrders();
    getUserOptions().then(setUserOptions);
    getArchiveOptionsByTypeName('系统').then(setSystemOptions);
    getArchiveOptionsByTypeName('问题类型').then(setProblemTypeOptions);
  }, []);

  const visibleRows = useMemo(() => {
    if (viewKey === 'mine') {
      return workOrders.filter((item) => item.followerId === currentFollowerId);
    }
    return workOrders;
  }, [currentFollowerId, viewKey, workOrders]);

  const filteredRows = useMemo(() => visibleRows.filter((row) => {
    const matchProblem = appliedFilters.problemDesc ? row.problemDesc.includes(appliedFilters.problemDesc) : true;
    const matchSystem = appliedFilters.systemId ? row.systemId === appliedFilters.systemId : true;
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
      && matchSystem
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
    sortedRows,
    sortState,
    total,
    setCurrentPage,
    setPageSize,
    handleTableChange,
    renderIndex
  } = useTemplateListPageData({ rows: filteredRows, sorters: workOrderSorters });

  const selectedRecords = useMemo(() => {
    const rowMap = new Map(sortedRows.map((row) => [row.id, row]));
    return selectedRowKeys
      .map((key) => rowMap.get(String(key)))
      .filter((row): row is WorkOrderRecord => Boolean(row));
  }, [selectedRowKeys, sortedRows]);

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
        key: 'systemId',
        label: '所属系统',
        node: (
          <AdminSelect
            size="small"
            value={draftFilters.systemId}
            options={systemOptions}
            placeholder="全部"
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, systemId: value }))}
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
            options={userOptions}
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
  }, [draftFilters, problemTypeOptions, systemOptions, userOptions, viewKey]);

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
      colSize: 2,
      formItemProps: { label: '问题描述' },
      sorter: true,
      sortOrder: sortState.field === 'problemDesc' ? sortState.order : null,
      renderFormItem: () => <AdminInput placeholder="请输入" />,
      render: (_, record) => {
        const problemSummary = richTextToSummary(record.problemDesc) || '-';
        return (
          <div className="work-order-problem-cell">
            <DetailLinkCell
              className="work-order-problem-cell__text"
              title={problemSummary}
              onClick={() => navigate(`/work-orders/${record.id}`)}
            >
              {problemSummary}
            </DetailLinkCell>
            {record.isOverdue ? <span className="work-order-problem-cell__tag">{renderOverdue(true)}</span> : null}
          </div>
        );
      }
    },
    {
      title: '所属系统',
      dataIndex: 'systemName',
      width: 140,
      ellipsis: true,
      sorter: true,
      sortOrder: sortState.field === 'systemName' ? sortState.order : null,
      render: (_, record) => record.systemName || '-',
      renderFormItem: () => <AdminSelect options={systemOptions} />
    },
    {
      title: '问题类型',
      dataIndex: 'problemType',
      width: 100,
      sorter: true,
      sortOrder: sortState.field === 'problemType' ? sortState.order : null,
      render: (_, record) => problemTypeText(record.problemType, record.problemTypeName),
      renderFormItem: () => <AdminSelect options={problemTypeOptions} />
    },
    {
      title: '跟进人',
      dataIndex: 'followerId',
      width: 80,
      search: viewKey === 'all',
      sorter: true,
      sortOrder: sortState.field === 'followerId' ? sortState.order : null,
      render: (_, record) => record.followerName || '-',
      renderFormItem: () => <AdminSelect options={userOptions} />
    },
    {
      title: '紧急程度',
      dataIndex: 'urgency',
      width: 96,
      sorter: true,
      sortOrder: sortState.field === 'urgency' ? sortState.order : null,
      render: (_, record) => renderUrgency(record.urgency),
      renderFormItem: () => <AdminSelect options={urgencyOptions} />
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 104,
      sorter: true,
      sortOrder: sortState.field === 'status' ? sortState.order : null,
      render: (_, record) => renderWorkOrderStatus(record.status),
      renderFormItem: () => <AdminSelect options={statusOptions} />
    },
    {
      title: '逾期',
      dataIndex: 'isOverdue',
      hideInTable: true,
      renderFormItem: () => (
        <AdminSelect
          options={[
            { label: '未逾期', value: false },
            { label: '逾期', value: true }
          ]}
        />
      )
    },
    {
      title: '提出人',
      dataIndex: 'submitterName',
      width: 80,
      sorter: true,
      sortOrder: sortState.field === 'submitterName' ? sortState.order : null,
      renderFormItem: () => <AdminInput placeholder="请输入" />
    },
    {
      title: '提出时间',
      dataIndex: 'submitTime',
      width: 130,
      search: false,
      sorter: true,
      sortOrder: sortState.field === 'submitTime' ? sortState.order : null,
      render: (_, record) => record.submitTime.slice(0, 10)
    },
    {
      title: '预计完成时间',
      dataIndex: 'expectedResolveDate',
      width: 130,
      search: false,
      sorter: true,
      sortOrder: sortState.field === 'expectedResolveDate' ? sortState.order : null
    },
    {
      title: '创建人',
      dataIndex: 'creatorName',
      width: 80,
      search: false,
      sorter: true,
      sortOrder: sortState.field === 'creatorName' ? sortState.order : null
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      search: false,
      sorter: true,
      sortOrder: sortState.field === 'createdAt' ? sortState.order : null
    },
    {
      title: '提出时间',
      dataIndex: 'submitTimeRange',
      hideInTable: true,
      renderFormItem: () => <AdminRangePicker />
    },
    {
      title: '预计完成时间',
      dataIndex: 'expectedResolveDateRange',
      hideInTable: true,
      renderFormItem: () => <AdminRangePicker />
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <OperationColumnActions>
          <AdminTextAction onClick={() => navigate(`/work-orders/${record.id}/edit`)}>
            编辑
          </AdminTextAction>
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
              if (key === 'copy') navigate(`/work-orders/${record.id}/copy`);
              if (key === 'delete') setDeleteOrder(record);
            }}
          />
        </OperationColumnActions>
      )
    }
  ], [navigate, problemTypeOptions, renderIndex, sortState, systemOptions, userOptions, viewKey]);

  const sameStatus = selectedRecords.length === 0 || selectedRecords.every((item) => item.status === selectedRecords[0].status);
  const availableNextStatuses = statusOptions.filter((item) => activeOrder ? statusTransitions[activeOrder.status].includes(item.value) : false);
  const batchStatusOptions = statusOptions.filter((item) => {
    const first = selectedRecords[0];
    return first ? statusTransitions[first.status].includes(item.value) : false;
  });
  const batchAssignTargetName = userOptions.find((item) => item.value === batchAssignTarget)?.label || '-';
  const batchAssignAlreadyCount = batchAssignTarget
    ? selectedRecords.filter((row) => row.followerId === batchAssignTarget).length
    : 0;
  const batchAssignUpdateCount = batchAssignTarget
    ? selectedRecords.length - batchAssignAlreadyCount
    : 0;
  const buildStatusPayload = (status: WorkOrderStatus, values: Record<string, unknown>) => ({
    status,
    resolveDate: values.actualFixedAt && typeof values.actualFixedAt === 'object' && 'format' in values.actualFixedAt
      ? (values.actualFixedAt as { format: (format: string) => string }).format('YYYY-MM-DD')
      : undefined,
    closeDate: values.closedAt && typeof values.closedAt === 'object' && 'format' in values.closedAt
      ? (values.closedAt as { format: (format: string) => string }).format('YYYY-MM-DD')
      : undefined,
    resultDesc: typeof values.result === 'string' ? values.result : undefined
  });
  const handleViewChange = (nextViewKey: ViewKey) => {
    setViewKey(nextViewKey);
    setSelectedRowKeys([]);
  };

  return (
    <>
    <TemplateListPage<WorkOrderRecord>
      mode="batch"
      title="运维工单"
      titleExtra={
        <ViewTabs<ViewKey>
          value={viewKey}
          onChange={handleViewChange}
          items={[
            { label: '全部', value: 'all', count: workOrders.length },
            {
              label: '我的工单',
              value: 'mine',
              count: workOrders.filter((item) => item.followerId === currentFollowerId).length
            }
          ]}
        />
      }
      actions={
        <ActionBar>
          <AdminButton type="primary" onClick={() => navigate('/work-orders/new')}>新增工单</AdminButton>
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
            setCurrentPage(1);
          }}
          onReset={() => {
            resetFilters();
            setSelectedRowKeys([]);
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
          onChange: (keys) => {
            setSelectedRowKeys(keys);
          }
        },
        onChange: handleTableChange,
        tableAlertRender: false,
        scroll: { x: 1580 }
      }}
      scrollYDeps={[
        filterExpanded,
        viewKey,
        total,
        currentPage,
        pageSize,
        pagedRows.length
      ]}
      batch={{
        selectedCount: selectedRecords.length,
        actions: (
          <>
            <AdminSearchDropdown
              disabled={selectedRecords.length === 0}
              placeholder="搜索跟进人"
              options={userOptions.map((user) => ({
                value: user.value,
                label: user.label,
                searchText: user.label
              }))}
              onSelect={async (value) => {
                if (selectedRecords.length === 0) {
                  message.warning('请先勾选要操作的工单');
                  return;
                }
                setBatchAssignTarget(value);
              }}
            >
              批量指派
            </AdminSearchDropdown>
            <AdminButton size="small" disabled={selectedRecords.length === 0} onClick={() => setBatchStatusOpen(true)}>
              批量状态变更
            </AdminButton>
            <DeleteConfirmAction
              size="small"
              disabled={selectedRecords.length === 0}
              entityName="工单"
              title="确认批量删除工单"
              description={(
                <div className="work-order-list-page__batch-delete-confirm">
                  <div>将删除选中的 <strong>{selectedRecords.length}</strong> 项工单。</div>
                  <div className="work-order-list-page__batch-delete-risk">删除后工单及处理记录无法恢复，请谨慎操作。</div>
                </div>
              )}
              successMessage={`已删除 ${selectedRecords.length} 项工单`}
              onConfirm={async () => {
                await Promise.all(selectedRecords.map((row) => deleteWorkOrder(row.id)));
                setSelectedRowKeys([]);
                await loadWorkOrders();
              }}
            >
              批量删除
            </DeleteConfirmAction>
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
        title="确认批量指派"
        open={Boolean(batchAssignTarget)}
        size="small"
        okText="确认"
        confirmLoading={batchAssignSubmitting}
        okButtonProps={{ disabled: selectedRecords.length === 0 }}
        onCancel={() => setBatchAssignTarget(undefined)}
        onOk={async () => {
          if (!batchAssignTarget || selectedRecords.length === 0) return;
          setBatchAssignSubmitting(true);
          try {
            const result = await batchAssignWorkOrders(selectedRecords.map((row) => row.id), batchAssignTarget);
            const unchanged = result.requested - result.updated;
            message.success(unchanged > 0
              ? `已更新 ${result.updated} 项，${unchanged} 项原本就是该跟进人`
              : `成功指派 ${result.updated} 项工单`);
            setSelectedRowKeys([]);
            setBatchAssignTarget(undefined);
            await loadWorkOrders();
          } finally {
            setBatchAssignSubmitting(false);
          }
        }}
      >
        <div className="work-order-list-page__delete-confirm">
          <div>将选中的 <strong>{selectedRecords.length}</strong> 项工单指派给 <strong>{batchAssignTargetName}</strong>。</div>
          <div>预计更新 <strong>{batchAssignUpdateCount}</strong> 项，<strong>{batchAssignAlreadyCount}</strong> 项原本就是该跟进人。</div>
          <div>确认后会更新这些工单的跟进人。</div>
        </div>
      </AdminModal>

      <AdminModal
        title="批量状态变更"
        open={batchStatusOpen && !sameStatus}
        size="small"
        onCancel={() => setBatchStatusOpen(false)}
        onOk={async () => {
          setBatchStatusOpen(false);
        }}
        okButtonProps={{ disabled: selectedRecords.length === 0 || !sameStatus }}
      >
        <AdminAlert
          type="warning"
          showIcon
          message="选中的工单状态不一致，无法批量变更。"
        />
      </AdminModal>

      <StatusChangeModal
        title="批量状态变更"
        open={batchStatusOpen && sameStatus && selectedRecords.length > 0}
        workOrder={selectedRecords[0]}
        targetStatus={batchTargetStatus}
        statusOptions={batchStatusOptions}
        preserveCompletedValues={false}
        onTargetStatusChange={setBatchTargetStatus}
        onCancel={() => {
          setBatchStatusOpen(false);
          setBatchTargetStatus(undefined);
        }}
        onConfirm={async (values) => {
          if (batchTargetStatus === undefined) return;
          await Promise.all(selectedRecords.map((row) => updateWorkOrderStatus(row.id, buildStatusPayload(batchTargetStatus, values))));
          await loadWorkOrders();
          message.success(`成功变更 ${selectedRecords.length} 项工单状态`);
          setSelectedRowKeys([]);
          setBatchStatusOpen(false);
          setBatchTargetStatus(undefined);
        }}
      />

      <AdminModal
        title="确认删除"
        open={Boolean(deleteOrder)}
        size="small"
        okText="删除"
        okButtonProps={{ danger: true }}
        onCancel={() => setDeleteOrder(null)}
        onOk={async () => {
          if (deleteOrder) {
            await deleteWorkOrder(deleteOrder.id);
            await loadWorkOrders();
            message.success('工单已删除');
          }
          setDeleteOrder(null);
        }}
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
        onConfirm={async (values) => {
          if (targetStatus === undefined || !activeOrder) return;
          await updateWorkOrderStatus(activeOrder.id, buildStatusPayload(targetStatus, values));
          await loadWorkOrders();
          message.success(`状态已更新为 ${statusText(targetStatus)}`);
          setActiveOrder(null);
          setTargetStatus(undefined);
        }}
      />
    </>
  );
}
