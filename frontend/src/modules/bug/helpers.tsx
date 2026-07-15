import { CategoryTag, defineCategoryToneMap, PriorityTag, StatusTag } from '../../components/admin';
import type { BugSeverity, BugStatus } from './types';

const bugSourceTypeTones = defineCategoryToneMap({ 1: 'blue', 2: 'cyan' });

export function renderBugSourceType(sourceType: 1 | 2) {
  return <CategoryTag tone={bugSourceTypeTones[sourceType]}>{sourceType === 1 ? '项目' : '需求'}</CategoryTag>;
}

export function renderBugStatus(status: BugStatus) {
  if (status === 0) return <StatusTag status="pending" text="新建" />;
  if (status === 1) return <StatusTag status="success" text="已修复" />;
  if (status === 2) return <StatusTag status="disabled" text="已关闭" />;
  return <StatusTag status="error" text="被激活" />;
}

export function renderBugSeverity(severity: BugSeverity) {
  const levels = { 1: 'low', 2: 'medium', 3: 'high', 4: 'critical' } as const;
  return <PriorityTag level={levels[severity]} text={({ 1: '低', 2: '中', 3: '高', 4: '致命' } as const)[severity]} />;
}
