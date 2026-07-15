import { useState } from 'react';
import type { Key } from 'react';
import { message } from 'antd';
import {
  AdminAlert,
  AdminButton,
  AdminModal,
  AdminSearchDropdown,
  DeleteConfirmAction
} from '../../../components/admin';
import { batchAssignWorkOrders, deleteWorkOrder, updateWorkOrderStatus } from '../../../api/workOrderApi';
import { WorkOrderStatusChangeAction } from '../components/WorkOrderStatusChangeAction';
import type { WorkOrderRecord } from '../types';
import { statusOptions } from '../helpers';
import { buildStatusPayload, statusTransitions } from './workOrderList.constants';

type Option = { label: string; value: string };

type UseWorkOrderBatchActionsParams = {
  selectedRecords: WorkOrderRecord[];
  userOptions: Option[];
  clearSelection: () => void;
  setSelectedRowKeys: (keys: Key[]) => void;
  reload: () => Promise<void>;
};

export function useWorkOrderBatchActions({
  selectedRecords,
  userOptions,
  clearSelection,
  setSelectedRowKeys,
  reload
}: UseWorkOrderBatchActionsParams) {
  const [batchStatusOpen, setBatchStatusOpen] = useState(false);
  const [batchAssignTarget, setBatchAssignTarget] = useState<string>();
  const [batchAssignSubmitting, setBatchAssignSubmitting] = useState(false);

  const sameStatus = selectedRecords.length === 0 || selectedRecords.every((item) => item.status === selectedRecords[0].status);
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

  return {
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
        {selectedRecords[0] && sameStatus ? (
          <WorkOrderStatusChangeAction
            size="small"
            workOrder={selectedRecords[0]}
            statusOptions={batchStatusOptions}
            onConfirm={async (target, values) => {
              await Promise.all(selectedRecords.map((row) => updateWorkOrderStatus(row.id, buildStatusPayload(target, values))));
              await reload();
              message.success(`成功变更 ${selectedRecords.length} 项工单状态`);
              setSelectedRowKeys([]);
            }}
          >
            批量状态变更
          </WorkOrderStatusChangeAction>
        ) : (
          <AdminButton size="small" disabled={selectedRecords.length === 0} onClick={() => setBatchStatusOpen(true)}>
            批量状态变更
          </AdminButton>
        )}
        <DeleteConfirmAction
          size="small"
          disabled={selectedRecords.length === 0}
          entityName="选中的"
          targetName={`${selectedRecords.length} 项工单`}
          title="确认批量删除工单"
          successMessage={`已删除 ${selectedRecords.length} 项工单`}
          onConfirm={async () => {
            await Promise.all(selectedRecords.map((row) => deleteWorkOrder(row.id)));
            clearSelection();
            await reload();
          }}
        >
          批量删除
        </DeleteConfirmAction>
      </>
    ),
    modals: (
      <>
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
              clearSelection();
              setBatchAssignTarget(undefined);
              await reload();
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

      </>
    )
  };
}
