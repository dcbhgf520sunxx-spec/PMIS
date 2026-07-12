import { useEffect, useState } from 'react';
import { App, Space } from 'antd';
import type { RuleObject } from 'antd/es/form';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AdminProFormRichDescription,
  AdminProFormDatePicker,
  AdminProFormSelect,
  AdminProFormText,
  TemplateFormPage,
  TemplateFormSection
} from '../../../components/admin';
import { getUserOptions } from '../../../api/userApi';
import { getArchiveOptionsByTypeName } from '../../../api/archiveApi';
import { createWorkOrder, getWorkOrder, updateWorkOrder, type WorkOrderFormPayload } from '../../../api/workOrderApi';
import type { WorkOrderRecord } from '../types';
import { urgencyOptions } from '../helpers';

type WorkOrderFormValues = Record<string, unknown> & {
  problemDesc: string;
  systemId: string;
  problemType: string;
  urgency: number;
  followerId: string;
  submitterName: string;
  submitterDept: string;
  submitTime: Dayjs;
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
    systemId: source.systemId,
    problemType: source.problemType,
    urgency: source.urgency,
    followerId: source.followerId,
    submitterName: source.submitterName,
    submitterDept: source.submitterDept,
    submitTime: dayjs(source.submitTime),
    expectedResolveDate: dayjs(source.expectedResolveDate)
  };
}

function toPayload(values: WorkOrderFormValues): WorkOrderFormPayload {
  return {
    problemDesc: values.problemDesc,
    systemId: values.systemId,
    problemType: values.problemType,
    urgency: Number(values.urgency),
    followerId: values.followerId,
    submitterName: values.submitterName,
    submitterDept: values.submitterDept,
    submitTime: values.submitTime.format('YYYY-MM-DD'),
    expectedResolveDate: values.expectedResolveDate.format('YYYY-MM-DD')
  };
}

export function WorkOrderFormPage({ mode }: { mode: 'create' | 'edit' | 'copy' }) {
  const navigate = useNavigate();
  const params = useParams();
  const { message } = App.useApp();
  const [source, setSource] = useState<WorkOrderRecord>();
  const [userOptions, setUserOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [systemOptions, setSystemOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [problemTypeOptions, setProblemTypeOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [loading, setLoading] = useState(mode !== 'create');
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [reloadRevision, setReloadRevision] = useState(0);
  const initialValues = source && mode !== 'create' ? toInitialValues(source) : undefined;
  const title = mode === 'edit' ? '编辑工单' : mode === 'copy' ? '复制工单' : '新增工单';

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    setNotFound(false);
    Promise.all([
      getUserOptions().then(setUserOptions),
      getArchiveOptionsByTypeName('系统').then(setSystemOptions),
      getArchiveOptionsByTypeName('问题类型').then(setProblemTypeOptions),
      mode !== 'create' && params.id ? getWorkOrder(params.id).then(setSource) : Promise.resolve()
    ]).catch((error) => {
      const messageText = error instanceof Error ? error.message : '工单表单加载失败';
      if (messageText.includes('不存在')) setNotFound(true);
      else setLoadError(messageText);
    }).finally(() => setLoading(false));
  }, [mode, params.id, reloadRevision]);

  return (
    <TemplateFormPage<WorkOrderFormValues>
      title={title}
      formId="work-order-form"
      loading={loading}
      error={loadError}
      notFound={notFound}
      onRetry={() => setReloadRevision((value) => value + 1)}
      initialValues={initialValues}
      titleExtra={source && mode !== 'create' ? (
        <Space size={8} className="admin-template-form-page__title-extra">
          <span className="admin-template-form-page__code">{source.code}</span>
        </Space>
      ) : null}
      onCancel={() => navigate('/work-orders')}
      fieldNameMap={{ problem_desc: 'problemDesc' }}
      onSubmit={async (values) => {
        const payload = toPayload(values);
        if (mode === 'edit' && params.id) {
          await updateWorkOrder(params.id, payload);
          message.success('工单已更新');
        } else {
          await createWorkOrder(payload);
          message.success('工单已创建');
        }
        navigate('/work-orders');
      }}
    >
      <TemplateFormSection title="基本信息">
        <div className="admin-template-form-page__grid">
                <AdminProFormRichDescription
                  className="admin-template-form-page__field is-full"
                  name="problemDesc"
                  label="问题描述"
                  placeholder="请输入问题描述，可粘贴图片"
                  rules={[
                    {
                      validator: async (_rule: RuleObject, value?: string) => {
                        if (isRichTextEmpty(value)) {
                          throw new Error('请输入问题描述');
                        }
                      }
                    }
                  ]}
                />
                <AdminProFormSelect
                  className="admin-template-form-page__field"
                  name="systemId"
                  label="所属系统"
                  options={systemOptions}
                  placeholder="请选择所属系统"
                  rules={[{ required: true, message: '请选择所属系统' }]}
                />
                <AdminProFormSelect
                  className="admin-template-form-page__field"
                  name="problemType"
                  label="问题类型"
                  options={problemTypeOptions}
                  placeholder="请选择问题类型"
                  rules={[{ required: true, message: '请选择问题类型' }]}
                />
                <AdminProFormSelect
                  className="admin-template-form-page__field"
                  name="urgency"
                  label="紧急程度"
                  options={urgencyOptions}
                  placeholder="请选择紧急程度"
                  rules={[{ required: true, message: '请选择紧急程度' }]}
                />
                <AdminProFormSelect
                  className="admin-template-form-page__field"
                  name="followerId"
                  label="跟进人"
                  options={userOptions}
                  placeholder="请选择跟进人"
                  rules={[{ required: true, message: '请选择跟进人' }]}
                />
        </div>
      </TemplateFormSection>

      <TemplateFormSection title="提出信息">
        <div className="admin-template-form-page__grid">
                <AdminProFormText
                  className="admin-template-form-page__field"
                  name="submitterName"
                  label="提出人"
                  placeholder="请输入提出人"
                  rules={[{ required: true, message: '请输入提出人' }]}
                />
                <AdminProFormText
                  className="admin-template-form-page__field"
                  name="submitterDept"
                  label="提出组织"
                  placeholder="请输入提出组织"
                  rules={[{ required: true, message: '请输入提出组织' }]}
                />
                <AdminProFormDatePicker
                  className="admin-template-form-page__field"
                  name="submitTime"
                  label="提出时间"
                  placeholder="请选择提出时间"
                  rules={[{ required: true, message: '请选择提出时间' }]}
                />
                <AdminProFormDatePicker
                  className="admin-template-form-page__field"
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
