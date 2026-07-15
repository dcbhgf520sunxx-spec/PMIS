import type { Dispatch, SetStateAction } from 'react';
import {
  AdminInput,
  AdminRangePicker,
  AdminSelect,
  CompactFilterBar,
  createListFilterItems
} from '../../../components/admin';
import { statusOptions, urgencyOptions } from '../helpers';
import type { WorkOrderListFilters, WorkOrderViewKey } from './workOrderList.types';

type Option = { label: string; value: string };

type WorkOrderListFilterBarProps = {
  draftFilters: WorkOrderListFilters;
  setDraftFilters: Dispatch<SetStateAction<WorkOrderListFilters>>;
  viewKey: WorkOrderViewKey;
  productOptions: Option[];
  problemTypeOptions: Option[];
  userOptions: Option[];
  onSearch: () => void;
  onReset: () => void;
};

export function WorkOrderListFilterBar({
  draftFilters,
  setDraftFilters,
  viewKey,
  productOptions,
  problemTypeOptions,
  userOptions,
  onSearch,
  onReset
}: WorkOrderListFilterBarProps) {
  const filterItems = createListFilterItems([
    {
      key: 'problemDesc',
      label: '问题描述',
      node: (
        <AdminInput
          size="small"
          value={draftFilters.problemDesc}
          placeholder="请输入"
          onChange={(event) => setDraftFilters((prev) => ({ ...prev, problemDesc: event.target.value }))}
          onPressEnter={onSearch}
        />
      )
    },
    {
      key: 'productId',
      label: '所属产品',
      node: (
        <AdminSelect
          size="small"
          value={draftFilters.productId}
          options={productOptions}
          placeholder="全部"
          onChange={(value) => setDraftFilters((prev) => ({ ...prev, productId: value }))}
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
          onPressEnter={onSearch}
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
          placeholder={['开始时间', '结束时间']}
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
          placeholder={['开始时间', '结束时间']}
          onChange={(value) => setDraftFilters((prev) => ({ ...prev, expectedResolveDateRange: value || [] }))}
        />
      )
    }
  ]);

  return (
    <CompactFilterBar
      items={filterItems}
      visibleCount={4}
      onSearch={onSearch}
      onReset={onReset}
    />
  );
}
