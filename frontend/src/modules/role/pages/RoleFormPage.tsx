import { useEffect, useState } from 'react';
import type { Key } from 'react';
import { App, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminProFormText, AdminProFormTextArea, TemplateFormPage, TemplateFormSection } from '../../../components/admin';
import {
  checkRoleCode,
  createRole,
  getMenuList,
  getRole,
  getRoleMenuIds,
  saveRoleMenuIds,
  updateRole,
  type MenuRecord,
  type RoleFormValues
} from '../../../api/roleApi';

type RoleFormPageProps = {
  mode: 'create' | 'edit';
};

export function RoleFormPage({ mode }: RoleFormPageProps) {
  const navigate = useNavigate();
  const params = useParams();
  const { message } = App.useApp();
  const [initialValues, setInitialValues] = useState<Partial<RoleFormValues>>();
  const [menuTree, setMenuTree] = useState<DataNode[]>([]);
  const [checkedMenuIds, setCheckedMenuIds] = useState<Key[]>([]);
  const [expandedMenuIds, setExpandedMenuIds] = useState<Key[]>([]);
  const [loading, setLoading] = useState(mode === 'edit');

  const buildMenuTree = (menus: MenuRecord[]): DataNode[] => {
    const nodeMap = new Map<number, DataNode>();
    const roots: DataNode[] = [];

    menus.forEach((menu) => {
      nodeMap.set(menu.id, {
        key: menu.id,
        title: menu.name,
        children: []
      });
    });

    menus.forEach((menu) => {
      const node = nodeMap.get(menu.id);
      if (!node) return;
      if (menu.parent_id === 0) {
        roots.push(node);
      } else {
        const parent = nodeMap.get(menu.parent_id);
        if (parent) {
          parent.children = [...(parent.children || []), node];
        }
      }
    });

    return roots;
  };

  const collectTreeKeys = (nodes: DataNode[]): Key[] => nodes.flatMap((node) => [
    node.key,
    ...collectTreeKeys(node.children || [])
  ]);

  useEffect(() => {
    if (mode === 'edit' && params.id) {
      Promise.all([
        getMenuList().then((menus) => {
          const tree = buildMenuTree(menus);
          setMenuTree(tree);
          setExpandedMenuIds(collectTreeKeys(tree));
        }),
        getRole(params.id).then((role) => setInitialValues(role)),
        getRoleMenuIds(params.id).then((ids) => setCheckedMenuIds(ids))
      ]).finally(() => setLoading(false));
      return;
    }

    setLoading(false);
  }, [mode, params.id]);

  return (
    <TemplateFormPage<RoleFormValues>
      title={mode === 'create' ? '新增角色' : '编辑角色'}
      formId="role-form"
      loading={loading}
      initialValues={initialValues}
      onCancel={() => navigate('/roles')}
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
        navigate('/roles');
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
            <Tree
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
