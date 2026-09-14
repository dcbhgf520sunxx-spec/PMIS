import { AdminDatePicker, AdminFormItem, AdminTextArea, StatusChangeAction, type StatusChangeActionProps } from '../../../components/admin';
import { allowedTaskStatuses, taskStatusLabels } from '../statusTransitions';
import type { TaskRecord, TaskStatus } from '../types';

type Props = Omit<StatusChangeActionProps<TaskStatus>, 'current' | 'currentValue' | 'options'> & { task: TaskRecord };

export function TaskStatusChangeAction({ task, ...props }: Props) {
  return <StatusChangeAction<TaskStatus>
    {...props}
    current={task.status}
    currentValue={taskStatusLabels[task.status]}
    options={allowedTaskStatuses(task).map((value) => ({ value, label: taskStatusLabels[value], tone: value === 3 ? 'danger' : value === 2 ? 'success' : 'normal' }))}
    renderExtra={(target) => <>
      {target === 2 ? <AdminFormItem name="actualEndTime" label="实际完成时间" rules={[{ required: true, message: '请选择实际完成时间' }]}><AdminDatePicker /></AdminFormItem> : null}
      {target === 3 ? <><AdminFormItem name="suspendTime" label="暂停时间" rules={[{ required: true, message: '请选择暂停时间' }]}><AdminDatePicker /></AdminFormItem><AdminFormItem name="suspendReason" label="暂停原因" rules={[{ required: true, whitespace: true, message: '请输入暂停原因' }, { max: 200, message: '暂停原因最多200字符' }]}><AdminTextArea rows={3} maxLength={200} showCount placeholder="请输入暂停原因" /></AdminFormItem></> : null}
    </>}
  />;
}
