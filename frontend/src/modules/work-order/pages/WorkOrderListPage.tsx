import { useMemo, useState } from 'react';
import type { Key } from 'react';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  ActionBar,
  AdminButton,
  createDetailNeighborContext,
  saveDetailNeighborContext,
  TemplateListPage,
  useCommittedFilters,
  ViewTabs
} from '../../../components/admin';
import { deleteWorkOrder, updateWorkOrderStatus } from '../../../api/workOrderApi';
import { buildWorkOrderQueryParams } from '../../../api/workOrderQueryParams';
import { useAuthStore } from '../../../stores/authStore';
import type { WorkOrderRecord } from '../types';
import type { WorkOrderViewKey } from './workOrderList.types';
import { statusText } from '../helpers';
import {
  buildStatusPayload,
  defaultWorkOrderListFilters,
  toDateText
} from './workOrderList.constants';
import { createWorkOrderColumns } from './WorkOrderListColumns';
import { WorkOrderListFilterBar } from './WorkOrderListFilterBar';
import { useWorkOrderBatchActions } from './useWorkOrderBatchActions';
import { useWorkOrderListData } from './useWorkOrderListData';
import './WorkOrderListPage.css';

export function WorkOrderListPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const currentFollowerId = currentUser ? String(currentUser.id) : '';
  const [viewKey, setViewKey] = useState<WorkOrderViewKey>('mine');
  const { draftFilters, appliedFilters, revision: filterRevision, setDraftFilters, commitFilters, resetFilters } = useCommittedFilters(defaultWorkOrderListFilters);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  const {
    viewCounts,
    listData,
    userOptions,
    systemOptions,
    problemTypeOptions,
    error,
    reload
  } = useWorkOrderListData({
    appliedFilters,
    currentFollowerId,
    filterRevision,
    viewKey
  });

  const selectedRecords = useMemo(() => {
    const rowMap = new Map(listData.sortedRows.map((row) => [row.id, row]));
    return selectedRowKeys
      .map((key) => rowMap.get(String(key)))
      .filter((row): row is WorkOrderRecord => Boolean(row));
  }, [selectedRowKeys, listData.sortedRows]);

  const clearSelection = () => setSelectedRowKeys([]);
  const buildCurrentNeighborParams = () => {
    const submitTimeRange = appliedFilters.submitTimeRange || [];
    const expectedRange = appliedFilters.expectedResolveDateRange || [];
    return buildWorkOrderQueryParams({
      problemDesc: appliedFilters.problemDesc || undefined,
      systemId: appliedFilters.systemId || undefined,
      problemType: appliedFilters.problemTypes,
      urgency: appliedFilters.urgency,
      status: appliedFilters.status,
      isOverdue: appliedFilters.isOverdue,
      filterFollowerId: appliedFilters.followerId || undefined,
      viewKey,
      currentUserId: currentFollowerId || undefined,
      submitterName: appliedFilters.submitterName || undefined,
      submitTimeFrom: toDateText(submitTimeRange[0]),
      submitTimeTo: toDateText(submitTimeRange[1]),
      expectedResolveDateFrom: toDateText(expectedRange[0]),
      expectedResolveDateTo: toDateText(expectedRange[1]),
      sortField: listData.sortState.field,
      sortOrder: listData.sortState.order || undefined
    });
  };

  const openDetail = (record: WorkOrderRecord) => {
    saveDetailNeighborContext(createDetailNeighborContext({
      moduleKey: 'work-order',
      routeBase: '/work-orders',
      params: buildCurrentNeighborParams()
    }));
    navigate(`/work-orders/${record.id}`);
  };

  const columns = useMemo(() => createWorkOrderColumns({
    navigate,
    renderIndex: listData.renderIndex,
    sortState: listData.sortState,
    systemOptions,
    problemTypeOptions,
    userOptions,
    viewKey,
    onOpenDetail: openDetail,
    onStatusChange: async (record, target, values) => {
      await updateWorkOrderStatus(record.id, buildStatusPayload(target, values));
      await reload();
      message.success(`状态已更新为 ${statusText(target)}`);
    },
    onDelete: async (record) => {
      await deleteWorkOrder(record.id);
      await reload();
      message.success('工单已删除');
    }
  }), [listData.renderIndex, listData.sortState, navigate, openDetail, problemTypeOptions, reload, systemOptions, userOptions, viewKey]);

  const batch = useWorkOrderBatchActions({
    selectedRecords,
    userOptions,
    clearSelection,
    setSelectedRowKeys,
    reload
  });

  const handleViewChange = (nextViewKey: WorkOrderViewKey) => {
    setViewKey(nextViewKey);
    clearSelection();
  };
  const handleSearch = () => {
    commitFilters();
    clearSelection();
  };
  const handleReset = () => {
    resetFilters();
    clearSelection();
  };

  return (
    <>
      <TemplateListPage<WorkOrderRecord>
        mode="batch"
        error={error}
        onRetry={reload}
        title="运维工单"
        titleExtra={
          <ViewTabs<WorkOrderViewKey>
            showCounts
            value={viewKey}
            onChange={handleViewChange}
            items={[
              { label: '全部', value: 'all', count: viewCounts.all },
              {
                label: '我的工单',
                value: 'mine',
                count: viewCounts.mine
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
          <WorkOrderListFilterBar
            draftFilters={draftFilters}
            setDraftFilters={setDraftFilters}
            viewKey={viewKey}
            systemOptions={systemOptions}
            problemTypeOptions={problemTypeOptions}
            userOptions={userOptions}
            onSearch={handleSearch}
            onReset={handleReset}
          />
        )}
        table={{
          columns,
          dataSource: listData.pagedRows,
          pagination: false,
          search: false,
          rowSelection: {
            selectedRowKeys,
            onChange: (keys) => {
              setSelectedRowKeys(keys);
            }
          },
          onChange: listData.handleTableChange,
          tableAlertRender: false,
          scroll: { x: 1580 }
        }}
        batch={{
          selectedCount: selectedRecords.length,
          actions: batch.actions
        }}
        pagination={listData.pagination}
      />

      {batch.modals}

    </>
  );
}
