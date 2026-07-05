import { message, Space } from 'antd';
import type { RuleObject } from 'antd/es/form';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { ProForm } from '@ant-design/pro-components';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AdminProFormDatePicker,
  AdminProFormSelect,
  AdminProFormText,
  RichDescriptionEditor,
  TemplateFormPage,
  TemplateFormSection
} from '../../../components/admin';
import { mockWorkOrders, workOrderUsers } from '../../work-order/mock';
import type { WorkOrderRecord } from '../../work-order/types';
import { problemTypeOptions, urgencyOptions } from '../../work-order/helpers';

type WorkOrderFormValues = Record<string, unknown> & {
  problemDesc: string;
  problemType: string;
  urgency: number;
  followerId: string;
  submitterName: string;
  submitterDept: string;
  submitTime: Dayjs;
  startTime?: Dayjs;
  expectedResolveDate: Dayjs;
};

function isRichTextEmpty(value?: string) {
  if (!value) return true;
  const template = document.createElement('template');
  template.innerHTML = value;
  return !template.content.textContent?.trim() && !template.content.querySelector('img');
}

function toInitialValues(source: WorkOrderRecord): Partial<WorkOrderFormValues> {
  return {
    problemDesc: source.problemDesc,
    problemType: source.problemType,
    urgency: source.urgency,
    followerId: source.followerId,
    submitterName: source.submitterName,
    submitterDept: source.submitterDept,
    submitTime: dayjs(source.submitTime),
    startTime: dayjs(source.createdAt),
    expectedResolveDate: dayjs(source.expectedResolveDate)
  };
}

export function WorkOrderTemplateFormPage({ mode }: { mode: 'create' | 'edit' | 'copy' }) {
  const navigate = useNavigate();
  const params = useParams();
  const source = mode === 'create' ? undefined : mockWorkOrders.find((item) => item.id === params.id);
  const initialValues = source ? toInitialValues(source) : undefined;
  const title = mode === 'edit' ? '编辑工单样板' : mode === 'copy' ? '复制工单样板' : '新增工单样板';

  return (
    <TemplateFormPage<WorkOrderFormValues>
      title={title}
      formId="work-order-template-form"
      initialValues={initialValues}
      titleExtra={source && mode !== 'create' ? (
        <Space size={8} className="admin-template-form-page__title-extra">
          <span className="admin-template-form-page__code">{source.code}</span>
        </Space>
      ) : null}
      onCancel={() => navigate('/samples/work-order')}
      onSubmit={async () => {
        message.success(mode === 'edit' ? '样板工单已更新' : '样板工单已创建');
        navigate('/samples/work-order');
      }}
    >
      <TemplateFormSection title="基本信息">
        <div className="admin-template-form-page__grid">
              <ProForm.Item
                className="admin-template-form-page__field is-full"
                name="problemDesc"
                label="问题描述"
                rules={[
                  {
                    validator: async (_rule: RuleObject, value?: string) => {
                      if (isRichTextEmpty(value)) throw new Error('请输入问题描述');
                    }
                  }
                ]}
              >
                <RichDescriptionEditor placeholder="请输入问题描述，可粘贴图片" />
              </ProForm.Item>
              <AdminProFormText
                className="admin-template-form-page__field"
                formItemProps={{ className: 'admin-template-form-page__field' }}
                name="systemName"
                label="所属系统"
                placeholder="请输入所属系统"
              />
              <AdminProFormSelect
                className="admin-template-form-page__field"
                formItemProps={{ className: 'admin-template-form-page__field' }}
                name="problemType"
                label="问题类型"
                options={problemTypeOptions}
                placeholder="请选择问题类型"
                rules={[{ required: true, message: '请选择问题类型' }]}
              />
              <AdminProFormSelect
                className="admin-template-form-page__field"
                formItemProps={{ className: 'admin-template-form-page__field' }}
                name="urgency"
                label="紧急程度"
                options={urgencyOptions}
                placeholder="请选择紧急程度"
                rules={[{ required: true, message: '请选择紧急程度' }]}
              />
        </div>
      </TemplateFormSection>

      <TemplateFormSection title="处理信息">
        <div className="admin-template-form-page__grid">
              <AdminProFormText
                className="admin-template-form-page__field"
                formItemProps={{ className: 'admin-template-form-page__field' }}
                name="submitterName"
                label="提出人"
                placeholder="请输入提出人"
                rules={[{ required: true, message: '请输入提出人' }]}
              />
              <AdminProFormText
                className="admin-template-form-page__field"
                formItemProps={{ className: 'admin-template-form-page__field' }}
                name="submitterDept"
                label="提出组织"
                placeholder="请输入提出组织"
                rules={[{ required: true, message: '请输入提出组织' }]}
              />
              <AdminProFormDatePicker
                className="admin-template-form-page__field"
                formItemProps={{ className: 'admin-template-form-page__field' }}
                name="submitTime"
                label="提出时间"
                placeholder="请选择提出时间"
                rules={[{ required: true, message: '请选择提出时间' }]}
              />
              <AdminProFormSelect
                className="admin-template-form-page__field"
                formItemProps={{ className: 'admin-template-form-page__field' }}
                name="followerId"
                label="跟进人"
                options={workOrderUsers}
                placeholder="请选择跟进人"
                rules={[{ required: true, message: '请选择跟进人' }]}
              />
              <AdminProFormDatePicker
                className="admin-template-form-page__field"
                formItemProps={{ className: 'admin-template-form-page__field' }}
                name="startTime"
                label="启动时间"
                placeholder="请选择启动时间"
              />
              <AdminProFormDatePicker
                className="admin-template-form-page__field"
                formItemProps={{ className: 'admin-template-form-page__field' }}
                name="expectedResolveDate"
                label="预计完成时间"
                placeholder="请选择预计完成时间"
                rules={[{ required: true, message: '请选择预计完成时间' }]}
              />
        </div>
      </TemplateFormSection>
    </TemplateFormPage>
  );
}
