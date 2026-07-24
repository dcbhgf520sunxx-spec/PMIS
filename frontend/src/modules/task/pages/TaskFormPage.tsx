import { useEffect, useState } from 'react';
import { App } from 'antd';
import { ProForm } from '@ant-design/pro-components';
import { useParams } from 'react-router-dom';
import { AdminProFormDatePicker, AdminProFormRichDescription, AdminProFormSelect, AdminProFormText, TemplateFormPage, TemplateFormSection , usePageReturnNavigation } from '../../../components/admin';
import { checkTaskName, createSubtask, createTask, getTask, getTaskProjectOptions, getTaskRequirementOptions, updateTask } from '../../../api/taskApi';
import { getUserOptions } from '../../../api/userApi';
import { getArchiveOptionsByTypeName } from '../../../api/archiveApi';
import type { TaskFormValues, TaskRecord } from '../types';

type Mode = 'create' | 'create-subtask' | 'edit' | 'copy';
type Option = { label: string; value: string };

export function TaskFormPage({ mode }: { mode: Mode }) {
  const { returnToSource } = usePageReturnNavigation('/tasks');
  const params = useParams();
  const { message } = App.useApp();
  const [form] = ProForm.useForm<TaskFormValues>();
  const [projects, setProjects] = useState<Option[]>([]);
  const [requirements, setRequirements] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [types, setTypes] = useState<Option[]>([]);
  const [sourceTask, setSourceTask] = useState<TaskRecord>();
  const [initial, setInitial] = useState<Partial<TaskFormValues>>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [revision, setRevision] = useState(0);
  const sourceType = ProForm.useWatch('sourceType', form);
  const subtaskMode = mode === 'create-subtask';
  const associationLocked = subtaskMode || Boolean(sourceTask?.parentTaskId);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setNotFound(false);
    setInitial(undefined);
    setSourceTask(undefined);
    Promise.all([
      getTaskProjectOptions(),
      getTaskRequirementOptions(),
      getUserOptions(),
      getArchiveOptionsByTypeName('任务类型'),
      mode !== 'create' && params.id ? getTask(params.id) : Promise.resolve(undefined)
    ]).then(([projectOptions, requirementOptions, userOptions, taskTypes, row]) => {
      if (cancelled) return;
      setProjects(projectOptions);
      setRequirements(requirementOptions);
      setUsers(userOptions);
      setTypes(taskTypes);
      if (row) {
        setSourceTask(row);
        setInitial(subtaskMode ? {
          parentTaskName: row.name,
          sourceType: row.sourceType,
          projectId: row.projectId || undefined,
          requirementId: row.requirementId || undefined,
          priority: 1
        } : {
          name: row.name,
          description: row.description,
          parentTaskName: row.parentTaskName || undefined,
          sourceType: row.sourceType,
          projectId: row.projectId || undefined,
          requirementId: row.requirementId || undefined,
          ownerIds: row.ownerIds,
          taskType: row.taskType,
          priority: row.priority,
          startTime: row.startTime || undefined,
          expectedEndTime: row.expectedEndTime || undefined
        });
      } else {
        setInitial({ sourceType: 1 });
      }
    }).catch((loadError) => {
      if (cancelled) return;
      const text = loadError instanceof Error ? loadError.message : '加载失败';
      if (text.includes('不存在')) setNotFound(true); else setError(text);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [mode, params.id, revision, subtaskMode]);

  const nameRules = [
    { required: true, message: '请输入任务名称' },
    {
      validator: async (_: unknown, value?: string) => {
        const name = value?.trim();
        if (!name) return;
        const result = await checkTaskName(name, mode === 'edit' ? params.id : undefined);
        if (!result.available) throw new Error('任务名称已存在');
      }
    }
  ];

  return <TemplateFormPage<TaskFormValues>
    title={mode === 'create' ? '新增任务' : subtaskMode ? '新增子任务' : mode === 'copy' ? '复制任务' : '编辑任务'}
    formId="task-form"
    form={form}
    initialValues={initial}
    loading={loading}
    error={error}
    notFound={notFound}
    onRetry={() => setRevision((value) => value + 1)}
    onCancel={returnToSource}
    fieldNameMap={{ source_type: 'sourceType', project_id: 'projectId', requirement_id: 'requirementId', owner_ids: 'ownerIds', task_type: 'taskType' }}
    onSubmit={async (values) => {
      if (mode === 'edit' && params.id) await updateTask(params.id, values);
      else if (subtaskMode && params.id) await createSubtask(params.id, values);
      else if (mode === 'copy' && sourceTask?.parentTaskId) await createSubtask(sourceTask.parentTaskId, values);
      else await createTask(values);
      message.success(mode === 'edit' ? '保存成功' : '新增成功');
      returnToSource();
    }}
  >
    <TemplateFormSection title="基本信息">
      <div className="admin-template-form-page__grid">
        <AdminProFormText name="name" label="任务名称" rules={nameRules} fieldProps={{ maxLength: 200 }} formItemProps={{ className: 'admin-template-form-page__field is-full' }} />
        <AdminProFormRichDescription name="description" label="任务描述" className="admin-template-form-page__field is-full" />
        {subtaskMode || sourceTask?.parentTaskId ? <AdminProFormText name="parentTaskName" label="所属主任务" disabled={subtaskMode || Boolean(sourceTask?.parentTaskId)} /> : null}
        <AdminProFormSelect name="sourceType" label="关联类型" options={[{ label: '项目', value: 1 }, { label: '需求', value: 2 }]} rules={[{ required: true, message: '请选择关联类型' }]} fieldProps={{ disabled: associationLocked }} />
        {sourceType === 2
          ? <AdminProFormSelect name="requirementId" label="关联需求" options={requirements} rules={[{ required: true, message: '请选择关联需求' }]} fieldProps={{ disabled: associationLocked }} />
          : <AdminProFormSelect name="projectId" label="关联项目" options={projects} rules={[{ required: true, message: '请选择关联项目' }]} fieldProps={{ disabled: associationLocked }} />}
        <AdminProFormSelect name="taskType" label="任务类型" options={types} rules={[{ required: true, message: '请选择任务类型' }]} />
        <AdminProFormSelect name="priority" label="优先级" options={[{ label: '低', value: 0 }, { label: '中', value: 1 }, { label: '高', value: 2 }]} />
      </div>
    </TemplateFormSection>
    <TemplateFormSection title="处理信息">
      <div className="admin-template-form-page__grid">
        <AdminProFormSelect name="ownerIds" label="负责人" mode="multiple" options={users} rules={[{ required: true, message: '请选择负责人' }]} />
        <AdminProFormDatePicker name="startTime" label="启动时间" />
        <AdminProFormDatePicker name="expectedEndTime" label="预计完成时间" />
      </div>
    </TemplateFormSection>
  </TemplateFormPage>;
}
