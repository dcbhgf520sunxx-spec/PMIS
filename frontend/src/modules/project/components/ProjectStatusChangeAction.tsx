import { Form } from 'antd';
import {
  AdminDatePicker,
  StatusChangeAction,
  StatusTag,
  type StatusChangeActionProps,
  type StatusChangeOption,
  type StatusFlowModalFormValues
} from '../../../components/admin';
import type { ProjectRecord, ProjectStatus } from '../types';
import { allowedProjectStatuses } from '../statusTransitions';

type Props = Omit<
  StatusChangeActionProps<ProjectStatus>,
  'current' | 'currentValue' | 'options' | 'renderExtra'
> & {
  project: ProjectRecord;
  onConfirm: (target: ProjectStatus, values: StatusFlowModalFormValues) => Promise<void> | void;
};

const labels: Record<ProjectStatus, string> = { 0: '未启动', 1: '进行中', 2: '已完成', 3: '暂停' };
const tones: Record<ProjectStatus, StatusChangeOption<ProjectStatus>['tone']> = { 0: 'normal', 1: 'normal', 2: 'success', 3: 'danger' };
const tagTones: Record<ProjectStatus, 'pending' | 'processing' | 'success' | 'error'> = { 0: 'pending', 1: 'processing', 2: 'success', 3: 'error' };

export function renderProjectStatus(status: ProjectStatus) {
  return <StatusTag status={tagTones[status]} text={labels[status]} />;
}

export function ProjectStatusChangeAction({ project, ...props }: Props) {
  return (
    <StatusChangeAction<ProjectStatus>
      {...props}
      current={project.status}
      currentValue={renderProjectStatus(project.status)}
      options={allowedProjectStatuses(project).map((value) => ({ label: labels[value], value, tone: tones[value] }))}
      renderExtra={(target) => (
        <>
          {target === 2 ? (
            <Form.Item name="actualEndDate" label="实际完成日期" rules={[{ required: true, message: '请选择实际完成日期' }]}>
              <AdminDatePicker placeholder="请选择实际完成日期" />
            </Form.Item>
          ) : null}
          {target === 3 ? (
            <Form.Item name="suspendDate" label="暂停日期" rules={[{ required: true, message: '请选择暂停日期' }]}>
              <AdminDatePicker placeholder="请选择暂停日期" />
            </Form.Item>
          ) : null}
        </>
      )}
    />
  );
}
