import type { ComponentProps, ReactNode } from 'react';
import { PriorityTag } from '../PriorityTag';
import { StatusChangeAction } from '../StatusChangeAction';

export type PriorityValue = 0 | 1 | 2;

type PriorityChangeActionProps = Omit<
  ComponentProps<typeof StatusChangeAction<PriorityValue>>,
  'currentValue' | 'options' | 'title' | 'currentLabel' | 'targetLabel' | 'onConfirm'
> & {
  current?: PriorityValue;
  currentValue?: ReactNode;
  currentLabel?: string;
  onConfirm: (priority: PriorityValue) => Promise<void> | void;
};

const priorityOptions = [
  { label: '低', value: 0 as const, tone: 'normal' as const },
  { label: '中', value: 1 as const, tone: 'normal' as const },
  { label: '高', value: 2 as const, tone: 'danger' as const },
];

function renderPriority(priority: PriorityValue) {
  return <PriorityTag level={priority === 2 ? 'high' : priority === 1 ? 'medium' : 'low'} text={priorityOptions[priority].label} />;
}

export function PriorityChangeAction({ current, currentValue, currentLabel, onConfirm, ...props }: PriorityChangeActionProps) {
  return (
    <StatusChangeAction<PriorityValue>
      {...props}
      current={current}
      currentValue={current !== undefined ? renderPriority(current) : (currentValue ?? '-')}
      options={priorityOptions}
      title="调整优先级"
      currentLabel={currentLabel ?? '当前优先级'}
      targetLabel="调整为"
      buttonText="调整优先级"
      onConfirm={(priority) => onConfirm(priority)}
    />
  );
}
