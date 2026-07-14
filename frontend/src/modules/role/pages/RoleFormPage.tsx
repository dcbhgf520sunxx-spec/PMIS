import { useEffect, useState } from 'react';
import type { Key } from 'react';
import { App } from 'antd';
import { useParams } from 'react-router-dom';
import { AdminProFormText, AdminProFormTextArea, AdminTree, TemplateFormPage, TemplateFormSection, usePageReturnNavigation } from '../../../components/admin';
import {
  checkRoleCode,
  createRole,
  getMenuList,
  getRole,
  getRoleMenuIds,
  saveRoleMenuIds,
  updateRole,
  type RoleFormValues
} from '../../../api/roleApi';
import { buildMenuTree, collectTreeKeys } from '../roleMenuTree';

type RoleFormPageProps = {
  mode: 'create' | 'edit';
};

export function RoleFormPage({ mode }: RoleFormPageProps) {
  const { returnToSource } = usePageReturnNavigation('/roles');
  const params = useParams();
  const { message } = App.useApp();
  const [initialValues, setInitialValues] = useState<Partial<RoleFormValues>>();
  const [menuTree, setMenuTree] = useState<import('antd/es/tree').DataNode[]>([]);
  const [checkedMenuIds, setCheckedMenuIds] = useState<Key[]>([]);
  const [expandedMenuIds, setExpandedMenuIds] = useState<Key[]>([]);
  const [loading, setLoading] = useState(mode === 'edit');
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [reloadRevision, setReloadRevision] = useState(0);

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    setNotFound(false);
    if (mode === 'edit' && params.id) {
      Promise.all([
        getMenuList().then((menus) => {
          const tree = buildMenuTree(menus);
          setMenuTree(tree);
          setExpandedMenuIds(collectTreeKeys(tree));
        }),
        getRole(params.id).then((role) => setInitialValues(role)),
        getRoleMenuIds(params.id).then((ids) => setCheckedMenuIds(ids))
      ]).catch((error) => {
        const messageText = error instanceof Error ? error.message : '角色表单加载失败';
        if (messageText.includes('不存在')) setNotFound(true);
        else setLoadError(messageText);
      }).finally(() => setLoading(false));
      return;
    }

    setLoading(false);
  }, [mode, params.id, reloadRevision]);

  return (
    <TemplateFormPage<RoleFormValues>
      title={mode === 'create' ? '新增角色' : '编辑角色'}
      formId="role-form"
      loading={loading}
      error={loadError}
      notFound={notFound}
      onRetry={() => setReloadRevision((value) => value + 1)}
      initialValues={initialValues}
      onCancel={returnToSource}
      onSubmit={async (values) => {
        let roleId = params.id;
        if (mode === 'create') {
          const created = await createRole(values);
          roleId = String(created.id);
          message.success('新增成功');
        } else if (params.id) {
          await updateRole(params.id, values);
          message.success('保存成功');
        }
        if (mode === 'edit' && roleId) {
          await saveRoleMenuIds(roleId, checkedMenuIds.map(Number));
        }
        returnToSource();
      }}
    >
      <TemplateFormSection title="基本信息">
        <div className="admin-template-form-page__grid">
          <AdminProFormText
            className="admin-template-form-page__field"
            formItemProps={{ className: 'admin-template-form-page__field' }}
            name="code"
            label="角色编码"
            disabled={mode === 'edit'}
            rules={[
              { required: true, message: '请输入角色编码' },
              {
                validator: async (_, value?: string) => {
                  if (!value) return;
                  const result = await checkRoleCode(value, mode === 'edit' ? params.id : undefined);
                  if (!result.available) throw new Error('角色编码已存在');
                }
              }
            ]}
          />
          <AdminProFormText
            className="admin-template-form-page__field"
            formItemProps={{ className: 'admin-template-form-page__field' }}
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          />
          <AdminProFormTextArea
            className="admin-template-form-page__field is-full"
            formItemProps={{ className: 'admin-template-form-page__field is-full' }}
            name="description"
            label="角色描述"
            fieldProps={{ rows: 4 }}
          />
        </div>
      </TemplateFormSection>

      {mode === 'edit' ? (
        <TemplateFormSection title="菜单权限">
          <div className="admin-template-form-page__tree">
            <AdminTree
              checkable
              expandedKeys={expandedMenuIds}
              treeData={menuTree}
              checkedKeys={menuTree.length ? checkedMenuIds : []}
              onExpand={(keys) => setExpandedMenuIds(keys)}
              onCheck={(keys) => {
                setCheckedMenuIds(Array.isArray(keys) ? keys : keys.checked);
              }}
            />
          </div>
        </TemplateFormSection>
      ) : null}
    </TemplateFormPage>
  );
}
