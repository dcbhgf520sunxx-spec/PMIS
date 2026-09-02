import {
  AdminDatePicker,
  AdminFormItem,
  StatusChangeAction,
  StatusTag,
  type StatusChangeActionProps,
  type StatusChangeOption,
  type StatusFlowModalFormValues
} from '../../../components/admin';
import type { ProjectRecord, ProjectStatus } from '../types';
import { allowedProjectStatuses, projectStatusLabels } from '../statusTransitions';

type Props = Omit<
  StatusChangeActionProps<ProjectStatus>,
  'current' | 'currentValue' | 'formValues' | 'options' | 'renderExtra'
> & {
  project: ProjectRecord;
  onConfirm: (target: ProjectStatus, values: StatusFlowModalFormValues) => Promise<void> | void;
};

const tones: Record<ProjectStatus, StatusChangeOption<ProjectStatus>['tone']> = { 0: 'normal', 1: 'normal', 2: 'success', 3: 'danger' };
const tagTones: Record<ProjectStatus, 'pending' | 'processing' | 'success' | 'error'> = { 0: 'pending', 1: 'processing', 2: 'success', 3: 'error' };

export function renderProjectStatus(status: ProjectStatus) {
  return <StatusTag status={tagTones[status]} text={projectStatusLabels[status]} />;
}

export function ProjectStatusChangeAction({ project, ...props }: Props) {
  return (
    <StatusChangeAction<ProjectStatus>
      {...props}
      current={project.status}
      currentValue={renderProjectStatus(project.status)}
      options={allowedProjectStatuses(project).map((value) => ({ label: projectStatusLabels[value], value, tone: tones[value] }))}
      renderExtra={(target) => (
        <>
          {target === 2 ? (
            <AdminFormItem name="actualEndDate" label="实际完成时间" rules={[{ required: true, message: '请选择实际完成时间' }]}>
              <AdminDatePicker placeholder="请选择实际完成时间" />
            </AdminFormItem>
          ) : null}
          {target === 3 ? (
            <AdminFormItem name="suspendDate" label="暂停时间" rules={[{ required: true, message: '请选择暂停时间' }]}>
              <AdminDatePicker placeholder="请选择暂停时间" />
            </AdminFormItem>
          ) : null}
        </>
      )}
    />
  );
}
