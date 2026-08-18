import { useState } from 'react';
import { message } from 'antd';
import { AdminModal, AdminSearchDropdown, DeleteConfirmAction, PriorityChangeAction } from '../../../components/admin';
import { batchAssignTasks, batchUpdateTaskPriority, deleteTask } from '../../../api/taskApi';
import type { TaskPriority, TaskRecord } from '../types';

type Option = { label: string; value: string };

export function useTaskBatchActions({ selectedRecords, users, clearSelection, reload }: { selectedRecords: TaskRecord[]; users: Option[]; clearSelection: () => void; reload: () => Promise<void> }) {
  const [assignTargets, setAssignTargets] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const targetNames = assignTargets.map((id) => users.find((user) => user.value === id)?.label).filter(Boolean).join('、');
  const unchanged = selectedRecords.filter((row) => (
    row.ownerIds.length === assignTargets.length
    && row.ownerIds.every((id) => assignTargets.includes(id))
  )).length;

  return {
    priorityAction: <PriorityChangeAction
      permission="task_priority_adjust"
      size="small"
      disabled={selectedRecords.length === 0}
      currentValue={`已选择 ${selectedRecords.length} 项任务`}
      currentLabel="调整对象"
      onConfirm={async (priority: TaskPriority) => {
        const result = await batchUpdateTaskPriority(selectedRecords.map((row) => row.id), priority);
        message.success(result.updated === result.requested
          ? `成功调整 ${result.updated} 项任务`
          : `已更新 ${result.updated} 项，${result.requested - result.updated} 项优先级未变化`);
        clearSelection();
        await reload();
      }}
    >批量调整优先级</PriorityChangeAction>,
    assignAction: <AdminSearchDropdown
      disabled={selectedRecords.length === 0}
      multiple
      placeholder="搜索负责人"
      options={users.map((user) => ({ value: user.value, label: user.label, searchText: user.label }))}
      onConfirm={(values) => setAssignTargets(values)}
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
      open={assignTargets.length > 0}
      size="small"
      okText="确认"
      confirmLoading={assigning}
      okButtonProps={{ disabled: selectedRecords.length === 0 || assignTargets.length === 0 }}
      onCancel={() => setAssignTargets([])}
      onOk={async () => {
        if (!assignTargets.length || selectedRecords.length === 0) return;
        setAssigning(true);
        try {
          const result = await batchAssignTasks(selectedRecords.map((row) => row.id), assignTargets);
          message.success(result.updated === result.requested ? `成功指派 ${result.updated} 项任务` : `已更新 ${result.updated} 项，${result.requested - result.updated} 项负责人未变化`);
          clearSelection();
          setAssignTargets([]);
          await reload();
        } finally {
          setAssigning(false);
        }
      }}
    >
      <div className="task-batch-assign-confirm">
        <div>将选中的 <strong>{selectedRecords.length}</strong> 项任务指派给 <strong>{targetNames || '-'}</strong>。</div>
        <div>预计更新 <strong>{selectedRecords.length - unchanged}</strong> 项，<strong>{unchanged}</strong> 项原本就是该负责人。</div>
      </div>
    </AdminModal>
  };
}
