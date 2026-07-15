import { useCallback, useEffect, useState } from 'react';
import { getArchiveOptionsByTypeName } from '../../../api/archiveApi';
import { getProductOptions } from '../../../api/productApi';
import { getUserOptions } from '../../../api/userApi';
import { getWorkOrderList } from '../../../api/workOrderApi';
import { useTemplateListPageData } from '../../../components/admin';
import type { WorkOrderRecord } from '../types';
import type { WorkOrderListFilters, WorkOrderViewKey } from './workOrderList.types';
import { toDateText, workOrderSorters } from './workOrderList.constants';

type Option = { label: string; value: string };

type UseWorkOrderListDataParams = {
  appliedFilters: WorkOrderListFilters;
  currentFollowerId: string;
  filterRevision: number;
  viewKey: WorkOrderViewKey;
};

export function useWorkOrderListData({
  appliedFilters,
  currentFollowerId,
  filterRevision,
  viewKey
}: UseWorkOrderListDataParams) {
  const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [viewCounts, setViewCounts] = useState({ all: 0, mine: 0 });
  const [userOptions, setUserOptions] = useState<Option[]>([]);
  const [productOptions, setProductOptions] = useState<Option[]>([]);
  const [problemTypeOptions, setProblemTypeOptions] = useState<Option[]>([]);
  const [error, setError] = useState('');
  const listData = useTemplateListPageData({
    rows: workOrders,
    sorters: workOrderSorters,
    resetOn: [filterRevision, viewKey],
    total: serverTotal,
    serverPaging: true,
    urlSync: true
  });

  const loadWorkOrders = useCallback(async () => {
    setError('');
    try {
    const submitTimeRange = appliedFilters.submitTimeRange || [];
    const expectedRange = appliedFilters.expectedResolveDateRange || [];
    const result = await getWorkOrderList({
      problemDesc: appliedFilters.problemDesc || undefined,
      productId: appliedFilters.productId || undefined,
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
      current: listData.currentPage,
      pageSize: listData.pageSize,
      sortField: listData.sortState.field,
      sortOrder: listData.sortState.order
    });
    setWorkOrders(result.list);
    setServerTotal(result.total);
    setViewCounts({
      all: result.viewCounts?.all ?? (viewKey === 'all' ? result.total : 0),
      mine: result.viewCounts?.mine ?? (viewKey === 'mine' ? result.total : 0)
    });
    } catch (loadError) {
      setWorkOrders([]);
      setServerTotal(0);
      setError(loadError instanceof Error ? loadError.message : '请求失败，请稍后重试');
    }
  }, [appliedFilters, currentFollowerId, listData.currentPage, listData.pageSize, listData.sortState.field, listData.sortState.order, viewKey]);

  useEffect(() => {
    loadWorkOrders();
  }, [loadWorkOrders]);

  useEffect(() => {
    getUserOptions().then(setUserOptions);
    getProductOptions().then((items) => setProductOptions(items.filter((item) => item.status === 1)));
    getArchiveOptionsByTypeName('问题类型').then(setProblemTypeOptions);
  }, []);

  return {
    viewCounts,
    listData,
    userOptions,
    productOptions,
    problemTypeOptions,
    error,
    reload: loadWorkOrders
  };
}
