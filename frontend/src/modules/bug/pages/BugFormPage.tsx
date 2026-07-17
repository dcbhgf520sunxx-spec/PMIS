import { useEffect, useState } from 'react';
import { App } from 'antd';
import { ProForm } from '@ant-design/pro-components';
import { useParams } from 'react-router-dom';
import { AdminProFormRichDescription, AdminProFormSelect, AdminProFormText, TemplateFormPage, TemplateFormSection , usePageReturnNavigation } from '../../../components/admin';
import { checkBugTitle, createBug, getBug, getBugProjectOptions, getBugRequirementOptions, updateBug } from '../../../api/bugApi';
import { getUserOptions } from '../../../api/userApi';
import { getArchiveOptionsByTypeName } from '../../../api/archiveApi';
import type { BugFormValues } from '../types';

type Mode = 'create' | 'edit' | 'copy';
type Option = { label: string; value: string };

export function BugFormPage({ mode }: { mode: Mode }) {
  const { returnToSource } = usePageReturnNavigation('/bugs');
  const params = useParams();
  const { message } = App.useApp();
  const [form] = ProForm.useForm<BugFormValues>();
  const [projects, setProjects] = useState<Option[]>([]);
  const [requirements, setRequirements] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [bugTypes, setBugTypes] = useState<Option[]>([]);
  const [initial, setInitial] = useState<Partial<BugFormValues>>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [revision, setRevision] = useState(0);
  const sourceType = ProForm.useWatch('sourceType', form);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setNotFound(false); setInitial(undefined);
    Promise.all([getBugProjectOptions(), getBugRequirementOptions(), getUserOptions(), getArchiveOptionsByTypeName('Bug类型'), mode !== 'create' && params.id ? getBug(params.id) : Promise.resolve(undefined)])
      .then(([projectOptions, requirementOptions, userOptions, typeOptions, row]) => {
        if (cancelled) return;
        setProjects(projectOptions); setRequirements(requirementOptions); setUsers(userOptions); setBugTypes(typeOptions);
        setInitial(row ? { title: row.title, description: row.description, sourceType: row.sourceType, projectId: row.projectId || undefined, requirementId: row.requirementId || undefined, bugTypeId: row.bugTypeId, severity: row.severity, assigneeId: row.assigneeId } : { sourceType: 1 });
      }).catch((cause) => {
        if (cancelled) return;
        const text = cause instanceof Error ? cause.message : '加载失败';
        if (text.includes('不存在')) setNotFound(true); else setError(text);
      }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode, params.id, revision]);

  const titleRules = [{ required: true, message: '请输入Bug标题' }, { validator: async (_: unknown, value?: string) => { const title = value?.trim(); if (!title) return; const result = await checkBugTitle(title, mode === 'edit' ? params.id : undefined); if (!result.available) throw new Error('Bug标题已存在'); } }];

  return <TemplateFormPage<BugFormValues>
    title={mode === 'create' ? '新增BUG' : mode === 'copy' ? '复制BUG' : '编辑BUG'}
    formId="bug-form" form={form} initialValues={initial} loading={loading} error={error} notFound={notFound}
    onRetry={() => setRevision((value) => value + 1)} onCancel={returnToSource}
    fieldNameMap={{ source_type: 'sourceType', project_id: 'projectId', requirement_id: 'requirementId', bug_type_id: 'bugTypeId', assignee_id: 'assigneeId' }}
    onSubmit={async (values) => { if (mode === 'edit' && params.id) await updateBug(params.id, values); else await createBug(values); message.success(mode === 'edit' ? '保存成功' : '新增成功'); returnToSource(); }}
  >
    <TemplateFormSection title="基本信息"><div className="admin-template-form-page__grid">
      <AdminProFormText name="title" label="Bug标题" rules={titleRules} fieldProps={{ maxLength: 200 }} formItemProps={{ className: 'admin-template-form-page__field is-full' }} />
      <AdminProFormRichDescription name="description" label="Bug描述" className="admin-template-form-page__field is-full" />
      <AdminProFormSelect name="sourceType" label="关联类型" options={[{ label: '项目', value: 1 }, { label: '需求', value: 2 }]} rules={[{ required: true, message: '请选择关联类型' }]} />
      {sourceType === 2 ? <AdminProFormSelect name="requirementId" label="关联需求" options={requirements} rules={[{ required: true, message: '请选择关联需求' }]} /> : <AdminProFormSelect name="projectId" label="关联项目" options={projects} rules={[{ required: true, message: '请选择关联项目' }]} />}
      <AdminProFormSelect name="bugTypeId" label="Bug类型" options={bugTypes} rules={[{ required: true, message: '请选择Bug类型' }]} />
      <AdminProFormSelect name="severity" label="严重程度" options={[{ label: '低', value: 1 }, { label: '中', value: 2 }, { label: '高', value: 3 }, { label: '致命', value: 4 }]} rules={[{ required: true, message: '请选择严重程度' }]} />
    </div></TemplateFormSection>
    <TemplateFormSection title="处理信息"><div className="admin-template-form-page__grid"><AdminProFormSelect name="assigneeId" label="指派给" options={users} rules={[{ required: true, message: '请选择指派人' }]} /></div></TemplateFormSection>
  </TemplateFormPage>;
}
