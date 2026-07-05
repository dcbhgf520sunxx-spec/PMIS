import { useState } from 'react';
import { Button, DatePicker, Form, Input, Modal, Space, Tag } from 'antd';
import zhCNDatePicker from 'antd/es/date-picker/locale/zh_CN';
import { AdminSelect } from '../AdminSelect';
import './index.css';

export type StatusFlowOption<T extends string = string> = {
  label: string;
  value: T;
  color?: string;
  requireDate?: boolean;
  requireRemark?: boolean;
};

type StatusFlowActionProps<T extends string = string> = {
  current: T;
  options: ReadonlyArray<StatusFlowOption<T>>;
  title?: string;
  buttonText?: string;
  onConfirm?: (payload: { target: T; date?: string; remark?: string }) => Promise<void> | void;
};

export function StatusFlowAction<T extends string = string>({
  current,
  options,
  title = '状态流转',
  buttonText = '变更状态',
  onConfirm
}: StatusFlowActionProps<T>) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<T>();
  const [date, setDate] = useState('');
  const [remark, setRemark] = useState('');
  const currentOption = options.find((item) => item.value === current);
  const targetOption = options.find((item) => item.value === target);

  return (
    <>
      <Button onClick={() => setOpen(true)}>{buttonText}</Button>
      <Modal
        title={title}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={async () => {
          if (!target) {
            return;
          }
          await onConfirm?.({ target, date, remark });
          setOpen(false);
        }}
        okButtonProps={{ disabled: !target }}
      >
        <div className="admin-status-flow">
          <div className="admin-status-flow__current">
            当前状态
            <Tag color={currentOption?.color || 'default'}>{currentOption?.label || current}</Tag>
          </div>
          <Form layout="vertical">
            <Form.Item label="目标状态" required>
              <AdminSelect
                value={target}
                placeholder="请选择下一状态"
                options={options
                  .filter((item) => item.value !== current)
                  .map((item) => ({ label: item.label, value: item.value }))}
                onChange={(next) => setTarget(next)}
              />
            </Form.Item>
            {targetOption?.requireDate ? (
              <Form.Item label="完成日期" required>
                <DatePicker locale={zhCNDatePicker} style={{ width: '100%' }} onChange={(_, value) => setDate(String(value || ''))} />
              </Form.Item>
            ) : null}
            {targetOption?.requireRemark ? (
              <Form.Item label="流转说明" required>
                <Input.TextArea rows={3} value={remark} onChange={(event) => setRemark(event.target.value)} />
              </Form.Item>
            ) : null}
          </Form>
          {targetOption ? (
            <Space>
              <span className="admin-status-flow__arrow">目标状态</span>
              <Tag color={targetOption.color || 'processing'}>{targetOption.label}</Tag>
            </Space>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
