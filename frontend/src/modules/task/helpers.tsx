import { AdminTag, CategoryTag, defineCategoryToneMap, OverdueTag, PriorityTag, StatusTag } from '../../components/admin';
import type { TaskPriority, TaskStatus } from './types';

const taskSourceTypeTones = defineCategoryToneMap({ 1: 'blue', 2: 'cyan' });
const taskMainLevelTones = defineCategoryToneMap({ main: 'indigo' });

export function renderTaskStatus(status: TaskStatus) {
  if (status === 0) return <StatusTag status="pending" text="待处理" />;
  if (status === 1) return <StatusTag status="processing" text="处理中" />;
  if (status === 2) return <StatusTag status="success" text="已完成" />;
  return <StatusTag status="disabled" text="已暂停" />;
}

export function renderTaskPriority(priority: TaskPriority) {
  return <PriorityTag level={priority === 2 ? 'high' : priority === 1 ? 'medium' : 'low'} text={['低', '中', '高'][priority]} />;
}

export function renderTaskSourceType(sourceType: 1 | 2) {
  return <CategoryTag tone={taskSourceTypeTones[sourceType]}>{sourceType === 1 ? '项目' : '需求'}</CategoryTag>;
}

export function renderTaskLevel(parentTaskId?: string) {
  return parentTaskId ? <AdminTag>子</AdminTag> : <CategoryTag tone={taskMainLevelTones.main}>主</CategoryTag>;
}

export function renderTaskOverdue(isOverdue: boolean, expectedEndTime?: string) {
  if (!isOverdue) return <OverdueTag overdueDays={0} />;
  const due = new Date(expectedEndTime || '');
  const overdueDays = Number.isNaN(due.getTime()) ? 1 : Math.max(1, Math.ceil((Date.now() - due.getTime()) / 86_400_000));
  return <OverdueTag overdueDays={overdueDays} />;
}
