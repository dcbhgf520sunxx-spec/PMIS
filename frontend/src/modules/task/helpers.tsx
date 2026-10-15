import { AdminTag, CategoryTag, defineCategoryToneMap, OverdueTag, PriorityTag, StatusTag } from '../../components/admin';
import type { TaskPriority, TaskStatus } from './types';
import './TaskLevel.css';

const taskSourceTypeTones = defineCategoryToneMap({ 1: 'blue', 2: 'cyan', 3: 'indigo' });
export const taskSourceTypeOptions = [{ label: '项目', value: 1 }, { label: '需求', value: 2 }, { label: '日常任务', value: 3 }];
const taskMainLevelTones = defineCategoryToneMap({ main: 'indigo' });

export function renderTaskStatus(status: TaskStatus) {
  if (status === 0) return <StatusTag status="pending" text="待处理" />;
  if (status === 1) return <StatusTag status="processing" text="处理中" />;
  if (status === 2) return <StatusTag status="success" text="已完成" />;
  if (status === 4) return <StatusTag status="disabled" text="已关闭" />;
  return <StatusTag status="disabled" text="已暂停" />;
}

export function renderTaskPriority(priority: TaskPriority) {
  return <PriorityTag level={priority === 2 ? 'high' : priority === 1 ? 'medium' : 'low'} text={['低', '中', '高'][priority]} />;
}

export function taskSourceTypeLabel(sourceType: 1 | 2 | 3) {
  return taskSourceTypeOptions.find(option => option.value === sourceType)?.label || '-';
}

export function renderTaskSourceType(sourceType: 1 | 2 | 3) {
  return <CategoryTag tone={taskSourceTypeTones[sourceType]}>{taskSourceTypeLabel(sourceType)}</CategoryTag>;
}

export function renderTaskLevel(parentTaskId?: string) {
  return parentTaskId ? <AdminTag className="task-level-tag">子</AdminTag> : <CategoryTag className="task-level-tag" tone={taskMainLevelTones.main}>主</CategoryTag>;
}

export function renderTaskOverdue(isOverdue: boolean, overdueDays?: number) {
  return <OverdueTag overdueDays={isOverdue ? overdueDays : 0} overdue={isOverdue && overdueDays === undefined} />;
}
