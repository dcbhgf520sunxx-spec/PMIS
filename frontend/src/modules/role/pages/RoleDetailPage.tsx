import { useEffect, useState } from 'react';
import type { Key } from 'react';
import { Button, message, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ActionBar,
  DeleteConfirmAction,
  DetailMetaList,
  PermissionButton,
  TemplateDetailPage,
  TemplateDetailSection
} from '../../../components/admin';
import {
  deleteRole,
  getMenuList,
  getRole,
  getRoleMenuIds,
  type MenuRecord,
  type RoleRecord
} from '../../../api/roleApi';

function buildMenuTree(menus: MenuRecord[]): DataNode[] {
  const nodeMap = new Map<number, DataNode>();
  const roots: DataNode[] = [];

  menus.forEach((menu) => {
    nodeMap.set(menu.id, { key: menu.id, title: menu.name, children: [] });
  });

  menus.forEach((menu) => {
    const node = nodeMap.get(menu.id);
    if (!node) return;
    if (menu.parent_id === 0) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(menu.parent_id);
      if (parent) parent.children = [...(parent.children || []), node];
    }
  });

  return roots;
}

function collectTreeKeys(nodes: DataNode[]): Key[] {
  return nodes.flatMap((node) => [
    node.key,
    ...collectTreeKeys(node.children || [])
  ]);
}

export function RoleDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [role, setRole] = useState<RoleRecord>();
  const [menuTree, setMenuTree] = useState<DataNode[]>([]);
  const [checkedMenuIds, setCheckedMenuIds] = useState<number[]>([]);
  const [expandedMenuIds, setExpandedMenuIds] = useState<Key[]>([]);

  useEffect(() => {
    if (!params.id) return;
    Promise.all([
      getRole(params.id).then(setRole),
      getMenuList().then((menus) => {
        const tree = buildMenuTree(menus);
        setMenuTree(tree);
        setExpandedMenuIds(collectTreeKeys(tree));
      }),
      getRoleMenuIds(params.id).then(setCheckedMenuIds)
    ]);
  }, [params.id]);

  return (
    <TemplateDetailPage
      title="角色详情"
      loading={!role}
      actions={
        <ActionBar>
          <Button onClick={() => navigate('/roles')}>返回</Button>
          {role ? (
            <PermissionButton type="primary" permission="role" onClick={() => navigate(`/roles/${role.id}/edit`)}>
              编辑
            </PermissionButton>
          ) : null}
          {role ? (
            <DeleteConfirmAction
              permission="role"
              entityName="角色"
              targetName={role.name}
              onConfirm={async () => {
                await deleteRole(role.id);
                message.success('删除成功');
                navigate('/roles');
              }}
              successMessage={false}
            >
              删除
            </DeleteConfirmAction>
          ) : null}
        </ActionBar>
      }
      documentSection={role ? {
        items: [
          { label: '创建人', value: role.creatorName || '-' },
          { label: '创建时间', value: role.createdAt || '-', wide: true },
          { label: '更新人', value: role.updaterName || '-' },
          { label: '更新时间', value: role.updatedAt || '-', wide: true }
        ]
      } : null}
    >
      {role ? (
        <>
          <TemplateDetailSection title="基本信息">
            <DetailMetaList
              items={[
                { label: '角色编码', value: role.code },
                { label: '角色名称', value: role.name },
                { label: '权限范围', value: role.permissions || '-' },
                { label: '角色描述', value: role.description || '-', wide: true }
              ]}
            />
          </TemplateDetailSection>
          <TemplateDetailSection title="菜单权限">
            <Tree
              checkable
              disabled
              expandedKeys={expandedMenuIds}
              treeData={menuTree}
              checkedKeys={menuTree.length ? checkedMenuIds : []}
              onExpand={(keys) => setExpandedMenuIds(keys)}
            />
          </TemplateDetailSection>
        </>
      ) : null}
    </TemplateDetailPage>
  );
}
