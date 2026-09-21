import { Form } from 'antd';
import dayjs from 'dayjs';
import { AdminDatePicker, AdminFormItem, AdminSelect, AdminTextArea } from '../../../components/admin';
import { requirementStatusesForType, requirementStatusLabels } from '../statusTransitions';
import type { RequirementType } from '../types';
export type RequirementReleaseValues = { status?: number; actualEndDate?: string; completionStatus?: string; pauseDate?: string; pauseReason?: string };
export function requirementReleasePayload(value?: RequirementReleaseValues) {
  if (!value) return undefined;
  return { status: value.status, actual_end_date: value.actualEndDate ? dayjs(value.actualEndDate).format('YYYY-MM-DD') : undefined, completion_status: value.completionStatus, pause_date: value.pauseDate ? dayjs(value.pauseDate).format('YYYY-MM-DD') : undefined, pause_reason: value.pauseReason };
}
export function RequirementReleaseFields({ requirementType, prefix }: { requirementType: RequirementType; prefix?: string }) {
  const form = Form.useFormInstance();
  const name = (field: string) => prefix ? [prefix, field] : field;
  const status = Form.useWatch(name('status'), form);
  return <>
    <AdminFormItem name={name('status')} label="原需求恢复状态" rules={[{ required: true, message: '请选择原需求恢复状态' }]}><AdminSelect options={requirementStatusesForType(requirementType).filter(value => value !== 36).map(value => ({ value, label: requirementStatusLabels[value] }))} /></AdminFormItem>
    {[33, 34].includes(status) ? <><AdminFormItem name={name('actualEndDate')} label="实际完成时间" rules={[{ required: true, message: '请选择实际完成时间' }]}><AdminDatePicker /></AdminFormItem><AdminFormItem name={name('completionStatus')} label="完成情况" rules={[{ required: true, whitespace: true, message: '请输入完成情况' }]}><AdminTextArea maxLength={200} /></AdminFormItem></> : null}
    {status === 35 ? <><AdminFormItem name={name('pauseDate')} label="暂停时间" rules={[{ required: true, message: '请选择暂停时间' }]}><AdminDatePicker /></AdminFormItem><AdminFormItem name={name('pauseReason')} label="暂停原因" rules={[{ required: true, whitespace: true, message: '请输入暂停原因' }]}><AdminTextArea maxLength={200} /></AdminFormItem></> : null}
  </>;
}
