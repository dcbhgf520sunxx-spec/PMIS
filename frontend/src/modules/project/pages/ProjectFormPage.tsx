import { useEffect, useMemo, useState } from 'react';
import { App } from 'antd';
import { ProForm } from '@ant-design/pro-components';
import { useParams } from 'react-router-dom';
import { AdminProFormDatePicker, AdminProFormSelect, AdminProFormText, AdminProFormTextArea, TemplateFormPage, TemplateFormSection, usePageReturnNavigation } from '../../../components/admin';
import { createProject, getProject, getProjectRequirementOptions, updateProject } from '../../../api/projectApi';
import { getProductOptions } from '../../../api/productApi';
import { getUserOptions } from '../../../api/userApi';
import type { ProjectFormValues } from '../types';

type RequirementOption = { label: string; value: string; productId: string };

export function ProjectFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { returnToSource } = usePageReturnNavigation('/projects');
  const params = useParams();
  const { message } = App.useApp();
  const [form] = ProForm.useForm<ProjectFormValues>();
  const productId = ProForm.useWatch('productId', form);
  const [products, setProducts] = useState<Array<{ label: string; value: string }>>([]);
  const [requirements, setRequirements] = useState<RequirementOption[]>([]);
  const [users, setUsers] = useState<Array<{ label: string; value: string }>>([]);
  const [initial, setInitial] = useState<Partial<ProjectFormValues>>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [rev, setRev] = useState(0);
  const requirementOptions = useMemo(
    () => productId ? requirements.filter((requirement) => requirement.productId === productId) : requirements,
    [requirements, productId]
  );

  const handleProductChange = (value: unknown) => {
    const nextProductId = typeof value === 'string' ? value : undefined;
    const selectedRequirementId = form.getFieldValue('requirementId');
    const selectedRequirement = requirements.find((requirement) => requirement.value === selectedRequirementId);
    if (!nextProductId || (selectedRequirement && selectedRequirement.productId !== nextProductId)) {
      form.setFieldValue('requirementId', undefined);
    }
  };

  const handleRequirementChange = (value: unknown) => {
    const nextRequirementId = typeof value === 'string' ? value : undefined;
    const selectedRequirement = requirements.find((requirement) => requirement.value === nextRequirementId);
    if (selectedRequirement) form.setFieldValue('productId', selectedRequirement.productId);
  };

  useEffect(() => {
    setLoading(true);
    setInitial(mode === 'create' ? { priority: 0 } : undefined);
    Promise.all([
      getProductOptions().then((value) => setProducts(value.filter((item) => item.status === 1))),
      getProjectRequirementOptions({ availableOnly: true, projectId: mode === 'edit' ? params.id : undefined }).then(setRequirements),
      getUserOptions().then(setUsers),
      mode === 'edit' && params.id
        ? getProject(params.id).then((row) => setInitial({
          name: row.name,
          productId: row.productId,
          requirementId: row.requirementId,
          priority: row.priority,
          ownerId: row.ownerId,
          memberIds: row.memberIds,
          startDate: row.startDate || undefined,
          expectedEndDate: row.expectedEndDate,
          description: row.description,
          progressText: row.progressText,
          riskText: row.riskText,
        }))
        : Promise.resolve(),
    ]).catch((reason) => {
      const text = reason instanceof Error ? reason.message : '加载失败';
      if (text.includes('不存在')) setNotFound(true); else setError(text);
    }).finally(() => setLoading(false));
  }, [mode, params.id, rev]);

  return <TemplateFormPage<ProjectFormValues>
    title={mode === 'create' ? '新增项目' : '编辑项目'}
    formId="project-form"
    form={form}
    fieldNameMap={{ requirement_id: 'requirementId' }}
    initialValues={initial}
    loading={loading}
    error={error}
    notFound={notFound}
    onRetry={() => setRev((value) => value + 1)}
    onCancel={returnToSource}
    onSubmit={async (values) => {
      if (mode === 'create') await createProject(values); else if (params.id) await updateProject(params.id, values);
      message.success(mode === 'create' ? '新增成功' : '保存成功');
      returnToSource();
    }}
  >
    <TemplateFormSection title="基本信息">
      <div className="admin-template-form-page__grid">
        <AdminProFormText name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]} fieldProps={{ maxLength: 200 }} />
        <AdminProFormSelect name="productId" label="所属产品" options={products} rules={[{ required: true, message: '请选择所属产品' }]} fieldProps={{ onChange: handleProductChange }} />
        <AdminProFormSelect name="requirementId" label="所属需求" options={requirementOptions} rules={[{ required: true, message: '请选择所属需求' }]} fieldProps={{ onChange: handleRequirementChange }} />
        <AdminProFormSelect name="ownerId" label="负责人" options={users} rules={[{ required: true, message: '请选择负责人' }]} />
        <AdminProFormSelect name="priority" label="优先级" options={[{ label: '低', value: 0 }, { label: '中', value: 1 }, { label: '高', value: 2 }]} disabled />
        <AdminProFormDatePicker name="startDate" label="启动时间" />
        <AdminProFormDatePicker name="expectedEndDate" label="预计完成时间" rules={[{ required: true, message: '请选择预计完成时间' }]} />
        <AdminProFormSelect name="memberIds" label="项目成员" mode="multiple" options={users} />
        <AdminProFormTextArea name="description" label="项目描述" fieldProps={{ rows: 4 }} formItemProps={{ className: 'admin-template-form-page__field is-full' }} />
      </div>
    </TemplateFormSection>
    <TemplateFormSection title="进展与风险">
      <div className="admin-template-form-page__grid">
        <AdminProFormTextArea name="progressText" label="进度记录" fieldProps={{ rows: 4 }} formItemProps={{className:'admin-template-form-page__field is-full'}} />
        <AdminProFormTextArea name="riskText" label="风险记录" fieldProps={{ rows: 4 }} formItemProps={{className:'admin-template-form-page__field is-full'}} />
      </div>
    </TemplateFormSection>
  </TemplateFormPage>;
}
