import { useState } from 'react';
import { message } from 'antd';
import { AdminButton, AdminFormItem, AdminModal, AdminSelect, DeleteConfirmAction } from '../../../components/admin';
import { batchAssignTasks, deleteTask } from '../../../api/taskApi';
import type { TaskRecord } from '../types';

type Option = { label: string; value: string };

export function useTaskBatchActions({ selectedRecords, users, clearSelection, reload }: { selectedRecords: TaskRecord[]; users: Option[]; clearSelection: () => void; reload: () => Promise<void> }) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTargets, setAssignTargets] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const targetNames = assignTargets.map((id) => users.find((user) => user.value === id)?.label).filter(Boolean).join('、');
  const unchanged = selectedRecords.filter((row) => row.ownerIds.join(',') === assignTargets.join(',')).length;

  return {
    assignAction: <AdminButton
      size="small"
      disabled={selectedRecords.length === 0}
      onClick={() => { setAssignTargets([]); setAssignOpen(true); }}
    >批量指派</AdminButton>,
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
      open={assignOpen}
      size="small"
      okText="确认"
      confirmLoading={assigning}
      okButtonProps={{ disabled: selectedRecords.length === 0 || assignTargets.length === 0 }}
      onCancel={() => setAssignOpen(false)}
      onOk={async () => {
        if (!assignTargets.length || selectedRecords.length === 0) return;
        setAssigning(true);
        try {
          const result = await batchAssignTasks(selectedRecords.map((row) => row.id), assignTargets);
          message.success(result.updated === result.requested ? `成功指派 ${result.updated} 项任务` : `已更新 ${result.updated} 项，${result.requested - result.updated} 项负责人未变化`);
          clearSelection();
          setAssignOpen(false);
          await reload();
        } finally {
          setAssigning(false);
        }
      }}
    >
      <div className="task-batch-assign-confirm">
        <AdminFormItem label="负责人" required>
          <AdminSelect mode="multiple" value={assignTargets} options={users} placeholder="请选择负责人" onChange={(value) => setAssignTargets(value.map(String))} />
        </AdminFormItem>
        <div>将选中的 <strong>{selectedRecords.length}</strong> 项任务指派给 <strong>{targetNames || '-'}</strong>。</div>
        <div>预计更新 <strong>{selectedRecords.length - unchanged}</strong> 项，<strong>{unchanged}</strong> 项原本就是该负责人。</div>
      </div>
    </AdminModal>
  };
}
