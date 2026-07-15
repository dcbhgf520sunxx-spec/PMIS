import { useState } from 'react';
import { message } from 'antd';
import { AdminModal, AdminSearchDropdown, DeleteConfirmAction } from '../../../components/admin';
import { batchAssignBugs, deleteBug } from '../../../api/bugApi';
import type { BugRecord } from '../types';

type Option = { label: string; value: string };

export function useBugBatchActions({ selectedRecords, users, clearSelection, reload }: { selectedRecords: BugRecord[]; users: Option[]; clearSelection: () => void; reload: () => Promise<void> }) {
  const [assignTarget, setAssignTarget] = useState<string>();
  const [assigning, setAssigning] = useState(false);
  const targetName = users.find((user) => user.value === assignTarget)?.label || '-';
  const unchanged = assignTarget ? selectedRecords.filter((row) => row.assigneeId === assignTarget).length : 0;
  return {
    assignAction: <AdminSearchDropdown disabled={selectedRecords.length === 0} placeholder="搜索指派人" options={users.map((user) => ({ value: user.value, label: user.label, searchText: user.label }))} onSelect={setAssignTarget}>批量指派</AdminSearchDropdown>,
    deleteAction: <DeleteConfirmAction size="small" disabled={selectedRecords.length === 0} entityName="选中的" targetName={`${selectedRecords.length} 项 BUG`} title="确认批量删除 BUG" successMessage={`已删除 ${selectedRecords.length} 项 BUG`} onConfirm={async () => { await Promise.all(selectedRecords.map((row) => deleteBug(row.id))); clearSelection(); await reload(); }}>批量删除</DeleteConfirmAction>,
    assignModal: <AdminModal title="确认批量指派" open={Boolean(assignTarget)} size="small" okText="确认" confirmLoading={assigning} onCancel={() => setAssignTarget(undefined)} onOk={async () => {
      if (!assignTarget || !selectedRecords.length) return;
      setAssigning(true);
      try {
        const result = await batchAssignBugs(selectedRecords.map((row) => row.id), assignTarget);
        message.success(result.updated === result.requested ? `成功指派 ${result.updated} 项 BUG` : `已更新 ${result.updated} 项，${result.requested - result.updated} 项指派人未变`);
        clearSelection(); setAssignTarget(undefined); await reload();
      } finally { setAssigning(false); }
    }}><div className="bug-batch-assign-confirm"><div>将选中的 <strong>{selectedRecords.length}</strong> 项 BUG 指派给 <strong>{targetName}</strong>。</div><div>预计更新 <strong>{selectedRecords.length - unchanged}</strong> 项，<strong>{unchanged}</strong> 项原本已是该指派人。</div></div></AdminModal>
  };
}
