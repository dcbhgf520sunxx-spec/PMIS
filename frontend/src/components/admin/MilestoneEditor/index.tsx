import { useMemo, useState } from 'react';
import { Button, DatePicker, Form, Input, Modal, Space } from 'antd';
import zhCNDatePicker from 'antd/es/date-picker/locale/zh_CN';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { MilestoneItem, MilestoneStatus } from '../MilestoneTimeline';
import { AdminSelect } from '../AdminSelect';
import './index.css';

type MilestoneEditorProps = {
  value?: MilestoneItem[];
  onChange?: (value: MilestoneItem[]) => void;
  title?: string;
};

const templates: Array<{ label: string; items: Omit<MilestoneItem, 'id'>[] }> = [
  {
    label: '项目交付',
    items: [
      { name: '需求确认', status: 'done', plannedDate: '' },
      { name: '方案评审', status: 'processing', plannedDate: '' },
      { name: '上线验收', status: 'pending', plannedDate: '' }
    ]
  },
  {
    label: '工单处理',
    items: [
      { name: '问题受理', status: 'done', plannedDate: '' },
      { name: '定位处理', status: 'processing', plannedDate: '' },
      { name: '结果确认', status: 'pending', plannedDate: '' }
    ]
  }
];

const statusOptions: Array<{ label: string; value: MilestoneStatus }> = [
  { label: '未开始', value: 'pending' },
  { label: '进行中', value: 'processing' },
  { label: '已完成', value: 'done' },
  { label: '阻塞', value: 'blocked' }
];

function createMilestone(partial?: Partial<MilestoneItem>): MilestoneItem {
  return {
    id: partial?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: partial?.name || '',
    status: partial?.status || 'pending',
    plannedDate: partial?.plannedDate || '',
    actualDate: partial?.actualDate || '',
    description: partial?.description || ''
  };
}

export function MilestoneEditor({ value = [], onChange, title = '编辑里程碑' }: MilestoneEditorProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MilestoneItem[]>(value);

  const safeValue = useMemo(() => value.map((item) => createMilestone(item)), [value]);

  const updateDraft = (next: MilestoneItem[]) => {
    setDraft(next);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.length) {
      return;
    }
    const next = [...draft];
    [next[index], next[target]] = [next[target], next[index]];
    updateDraft(next);
  };

  return (
    <>
      <Button onClick={() => {
        setDraft(safeValue);
        setOpen(true);
      }}>
        {title}
      </Button>
      <Modal
        title={title}
        width={760}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => {
          onChange?.(draft.filter((item) => item.name.trim()));
          setOpen(false);
        }}
      >
        <Space className="admin-milestone-editor__toolbar" wrap>
          <Button icon={<PlusOutlined />} onClick={() => updateDraft([...draft, createMilestone()])}>
            新增节点
          </Button>
          <AdminSelect
            placeholder="套用模板"
            style={{ width: 160 }}
            options={templates.map((item) => ({ label: item.label, value: item.label }))}
            onChange={(templateLabel) => {
              const template = templates.find((item) => item.label === templateLabel);
              if (template) {
                updateDraft(template.items.map((item) => createMilestone(item)));
              }
            }}
          />
        </Space>
        <div className="admin-milestone-editor">
          {draft.map((item, index) => (
            <div className="admin-milestone-editor__item" key={item.id}>
              <div className="admin-milestone-editor__sort">
                <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => move(index, -1)} />
                <Button size="small" icon={<ArrowDownOutlined />} disabled={index === draft.length - 1} onClick={() => move(index, 1)} />
              </div>
              <Form layout="vertical" className="admin-milestone-editor__form">
                <Form.Item label="节点名称" required>
                  <Input
                    value={item.name}
                    placeholder="如：需求确认"
                    onChange={(event) => {
                      const next = [...draft];
                      next[index] = { ...item, name: event.target.value };
                      updateDraft(next);
                    }}
                  />
                </Form.Item>
                <Form.Item label="状态">
                  <AdminSelect
                    value={item.status}
                    options={statusOptions}
                    onChange={(status) => {
                      const next = [...draft];
                      next[index] = { ...item, status };
                      updateDraft(next);
                    }}
                  />
                </Form.Item>
                <Form.Item label="计划日期">
                  <DatePicker
                    locale={zhCNDatePicker}
                    style={{ width: '100%' }}
                    onChange={(_, dateString) => {
                      const next = [...draft];
                      next[index] = { ...item, plannedDate: String(dateString || '') };
                      updateDraft(next);
                    }}
                  />
                </Form.Item>
                <Form.Item label="实际日期">
                  <DatePicker
                    locale={zhCNDatePicker}
                    style={{ width: '100%' }}
                    onChange={(_, dateString) => {
                      const next = [...draft];
                      next[index] = { ...item, actualDate: String(dateString || '') };
                      updateDraft(next);
                    }}
                  />
                </Form.Item>
                <Form.Item label="说明" className="admin-milestone-editor__desc">
                  <Input.TextArea
                    rows={2}
                    value={item.description}
                    placeholder="可补充节点口径、验收要求或阻塞原因"
                    onChange={(event) => {
                      const next = [...draft];
                      next[index] = { ...item, description: event.target.value };
                      updateDraft(next);
                    }}
                  />
                </Form.Item>
              </Form>
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => updateDraft(draft.filter((target) => target.id !== item.id))}
              />
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
