import { useState } from 'react';
import { message } from 'antd';
import { AdminModal, AdminSearchDropdown, DeleteConfirmAction } from '../../../components/admin';
import { batchAssignTasks, deleteTask } from '../../../api/taskApi';
import type { TaskRecord } from '../types';

type Option = { label: string; value: string };

export function useTaskBatchActions({ selectedRecords, users, clearSelection, reload }: { selectedRecords: TaskRecord[]; users: Option[]; clearSelection: () => void; reload: () => Promise<void> }) {
  const [assignTarget, setAssignTarget] = useState<string>();
  const [assigning, setAssigning] = useState(false);
  const targetName = users.find((user) => user.value === assignTarget)?.label || '-';
  const unchanged = assignTarget ? selectedRecords.filter((row) => row.ownerId === assignTarget).length : 0;

  return {
    assignAction: <AdminSearchDropdown
      disabled={selectedRecords.length === 0}
      placeholder="搜索负责人"
      options={users.map((user) => ({ value: user.value, label: user.label, searchText: user.label }))}
      onSelect={(value) => setAssignTarget(value)}
    >批量指派</AdminSearchDropdown>,
    deleteAction: <DeleteConfirmAction
      size="small"
      disabled={selectedRecords.length === 0}
      entityName="选中的"
      targetName={`${selectedRecords.length} 项任务`}
      title="确认批量删除任务"
      successMessage={`已删除 ${selectedRecords.length} 项任务`}
      onConfirm={async () => {
        await Promise.all(selectedRecords.map((row) => deleteTask(row.id)));
        clearSelection();
        await reload();
      }}
    >批量删除</DeleteConfirmAction>,
    assignModal: <AdminModal
      title="确认批量指派"
      open={Boolean(assignTarget)}
      size="small"
      okText="确认"
      confirmLoading={assigning}
      okButtonProps={{ disabled: selectedRecords.length === 0 }}
      onCancel={() => setAssignTarget(undefined)}
      onOk={async () => {
        if (!assignTarget || selectedRecords.length === 0) return;
        setAssigning(true);
        try {
          const result = await batchAssignTasks(selectedRecords.map((row) => row.id), assignTarget);
          message.success(result.updated === result.requested ? `成功指派 ${result.updated} 项任务` : `已更新 ${result.updated} 项，${result.requested - result.updated} 项负责人未变化`);
          clearSelection();
          setAssignTarget(undefined);
          await reload();
        } finally {
          setAssigning(false);
        }
      }}
    >
      <div className="task-batch-assign-confirm">
        <div>将选中的 <strong>{selectedRecords.length}</strong> 项任务指派给 <strong>{targetName}</strong>。</div>
        <div>预计更新 <strong>{selectedRecords.length - unchanged}</strong> 项，<strong>{unchanged}</strong> 项原本就是该负责人。</div>
      </div>
    </AdminModal>
  };
}
