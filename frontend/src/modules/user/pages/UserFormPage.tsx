import { useEffect, useState } from 'react';
import { App } from 'antd';
import type { RuleObject } from 'antd/es/form';
import { ProForm } from '@ant-design/pro-components';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminProFormSelect, AdminProFormText, TemplateFormPage, TemplateFormSection } from '../../../components/admin';
import {
  checkEmployeeNo,
  checkPhone,
  createUser,
  getUser,
  updateUser
} from '../../../api/userApi';
import { getRoleOptions } from '../../../api/roleApi';
import type { UserFormValues } from '../types';

type UserFormPageProps = {
  mode: 'create' | 'edit';
};

function mergeRoleOptions(
  options: Array<{ label: string; value: string }>,
  currentRoles: Array<{ label: string; value: string }>
) {
  const optionMap = new Map(options.map((option) => [option.value, option]));
  currentRoles.forEach((role) => {
    if (!optionMap.has(role.value)) optionMap.set(role.value, role);
  });
  return Array.from(optionMap.values());
}

export function UserFormPage({ mode }: UserFormPageProps) {
  const navigate = useNavigate();
  const params = useParams();
  const { message } = App.useApp();
  const [initialValues, setInitialValues] = useState<Partial<UserFormValues>>();
  const [roleOptions, setRoleOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [currentRoleOptions, setCurrentRoleOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [form] = ProForm.useForm<UserFormValues>();

  useEffect(() => {
    Promise.all([
      getRoleOptions().then(setRoleOptions),
      mode === 'edit' && params.id ? getUser(params.id).then((user) => {
        setCurrentRoleOptions(user.roles?.map((role) => ({ label: role.name, value: String(role.id) })) || []);
        setInitialValues({
          employeeNo: user.employeeNo,
          realName: user.realName,
          phone: user.phone,
          roleIds: user.roleIds || []
        });
      }) : Promise.resolve()
    ]).finally(() => setLoading(false));
  }, [mode, params.id]);

  const mergedRoleOptions = mergeRoleOptions(roleOptions, currentRoleOptions);

  return (
    <TemplateFormPage<UserFormValues>
      title={mode === 'create' ? '新增用户' : '编辑用户'}
      formId="user-form"
      form={form}
      loading={loading}
      initialValues={initialValues}
      onCancel={() => navigate('/users')}
      onSubmit={async (values) => {
        if (mode === 'create') {
          await createUser(values);
          message.success('新增成功');
        } else if (params.id) {
          await updateUser(params.id, values);
          message.success('保存成功');
        }
        navigate('/users');
      }}
    >
      <TemplateFormSection title="基本信息">
        <div className="admin-template-form-page__grid">
          <AdminProFormText
            className="admin-template-form-page__field"
            formItemProps={{ className: 'admin-template-form-page__field' }}
            name="employeeNo"
            label="工号"
            disabled={mode === 'edit'}
            rules={[
              { required: true, message: '请输入工号' },
              {
                validator: async (_rule: RuleObject, value?: string) => {
                  if (!value || mode !== 'create') return;
                  const result = await checkEmployeeNo(value);
                  if (!result.available) throw new Error('工号已存在');
                }
              }
            ]}
          />
          <AdminProFormText
            className="admin-template-form-page__field"
            formItemProps={{ className: 'admin-template-form-page__field' }}
            name="realName"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          />
          <AdminProFormText
            className="admin-template-form-page__field"
            formItemProps={{ className: 'admin-template-form-page__field' }}
            name="phone"
            label="手机号"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' },
              {
                validator: async (_rule: RuleObject, value?: string) => {
                  if (!value) return;
                  const result = await checkPhone(value, mode === 'edit' ? params.id : undefined);
                  if (!result.available) throw new Error('手机号已存在');
                }
              }
            ]}
          />
          <AdminProFormSelect
            className="admin-template-form-page__field"
            formItemProps={{ className: 'admin-template-form-page__field' }}
            name="roleIds"
            label="所属角色"
            mode="multiple"
            options={mergedRoleOptions}
            rules={[{ required: true, message: '请选择角色' }]}
          />
        </div>
      </TemplateFormSection>
    </TemplateFormPage>
  );
}
