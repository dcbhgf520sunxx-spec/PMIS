import { AdminDatePicker, AdminFormItem, AdminSelect, AdminTextArea, StatusChangeAction, type StatusChangeActionProps } from '../../../components/admin';
import { allowedBugStatuses, bugStatusLabels } from '../statusTransitions';
import { renderBugStatus } from '../helpers';
import type { BugRecord, BugStatus } from '../types';

type Option = { label: string; value: string };
type Props = Omit<StatusChangeActionProps<BugStatus>, 'current' | 'currentValue' | 'options'> & { bug: BugRecord; resolutionOptions: Option[] };

export function BugStatusChangeAction({ bug, resolutionOptions, ...props }: Props) {
  return <StatusChangeAction<BugStatus>
    {...props}
    current={bug.status}
    currentValue={renderBugStatus(bug.status)}
    options={allowedBugStatuses(bug.status).map((value) => ({ value, label: bugStatusLabels[value], tone: value === 3 ? 'danger' : value === 1 ? 'success' : 'normal' }))}
    renderExtra={(target) => <>
      {target === 1 ? <AdminFormItem name="resolvedTime" label="修复时间" rules={[{ required: true, message: '请选择修复时间' }]}><AdminDatePicker /></AdminFormItem> : null}
      {target === 1 ? <AdminFormItem name="resolutionId" label="解决方案" rules={[{ required: true, message: '请选择解决方案' }]}><AdminSelect options={resolutionOptions} /></AdminFormItem> : null}
      {target === 2 ? <AdminFormItem name="closedTime" label="关闭时间" rules={[{ required: true, message: '请选择关闭时间' }]}><AdminDatePicker /></AdminFormItem> : null}
      {target === 3 ? <AdminFormItem name="activationReason" label="激活原因" rules={[{ required: true, whitespace: true, message: '请填写激活原因' }, { max: 100, message: '激活原因不能超过100字' }]}><AdminTextArea rows={4} maxLength={100} showCount placeholder="请输入激活原因" /></AdminFormItem> : null}
    </>}
  />;
}
