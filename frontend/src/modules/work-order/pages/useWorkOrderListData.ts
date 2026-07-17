import { useEffect, useState } from 'react';
import { getArchiveOptionsByTypeName } from '../../../api/archiveApi';
import { getProductOptions } from '../../../api/productApi';
import { getUserOptions } from '../../../api/userApi';
import { getWorkOrderList } from '../../../api/workOrderApi';
import { useTemplateServerListData } from '../../../components/admin';
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
  const [userOptions, setUserOptions] = useState<Option[]>([]);
  const [productOptions, setProductOptions] = useState<Option[]>([]);
  const [problemTypeOptions, setProblemTypeOptions] = useState<Option[]>([]);
  const listData = useTemplateServerListData<WorkOrderRecord, { viewCounts: { all: number; mine: number } }>({
    queryKey: ['work-orders', appliedFilters, currentFollowerId, filterRevision, viewKey],
    request: async ({ current, pageSize, sortField, sortOrder }) => {
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
        current,
        pageSize,
        sortField,
        sortOrder
      });
      return {
        list: result.list,
        total: result.total,
        meta: {
          viewCounts: {
            all: result.viewCounts?.all ?? (viewKey === 'all' ? result.total : 0),
            mine: result.viewCounts?.mine ?? (viewKey === 'mine' ? result.total : 0)
          }
        }
      };
    },
    sorters: workOrderSorters,
    urlSync: true
  });

  useEffect(() => {
    getUserOptions().then(setUserOptions).catch(() => undefined);
    getProductOptions().then((items) => setProductOptions(items.filter((item) => item.status === 1))).catch(() => undefined);
    getArchiveOptionsByTypeName('问题类型').then(setProblemTypeOptions).catch(() => undefined);
  }, []);

  return {
    viewCounts: listData.meta?.viewCounts ?? { all: 0, mine: 0 },
    listData,
    userOptions,
    productOptions,
    problemTypeOptions,
    error: listData.error,
    reload: listData.reload
  };
}
