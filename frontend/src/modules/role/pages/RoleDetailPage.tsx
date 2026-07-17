import { useEffect, useState } from 'react';
import type { Key } from 'react';
import { message } from 'antd';
import { useParams } from 'react-router-dom';
import {
  AdminTree,
  DeleteConfirmAction,
  DetailMetaList,
  PermissionButton,
  TemplateDetailPage,
  TemplateDetailSection,
  usePageReturnNavigation
} from '../../../components/admin';
import {
  deleteRole,
  getMenuList,
  getRole,
  getRoleMenuIds,
  type RoleRecord
} from '../../../api/roleApi';
import { buildMenuTree, collectTreeKeys } from '../roleMenuTree';

export function RoleDetailPage() {
  const { navigateWithReturn, returnToSource } = usePageReturnNavigation('/roles');
  const params = useParams();
  const [role, setRole] = useState<RoleRecord>();
  const [menuTree, setMenuTree] = useState<import('antd/es/tree').DataNode[]>([]);
  const [checkedMenuIds, setCheckedMenuIds] = useState<number[]>([]);
  const [expandedMenuIds, setExpandedMenuIds] = useState<Key[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [reloadRevision, setReloadRevision] = useState(0);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    setLoadError('');
    setNotFound(false);
    setRole(undefined);
    Promise.all([
      getRole(params.id).then(setRole),
      getMenuList().then((menus) => {
        const tree = buildMenuTree(menus);
        setMenuTree(tree);
        setExpandedMenuIds(collectTreeKeys(tree));
      }),
      getRoleMenuIds(params.id).then(setCheckedMenuIds)
    ]).catch((error) => {
      const messageText = error instanceof Error ? error.message : '角色加载失败';
      if (messageText.includes('不存在')) setNotFound(true);
      else setLoadError(messageText);
    }).finally(() => setLoading(false));
  }, [params.id, reloadRevision]);

  return (
    <TemplateDetailPage
      title="角色详情"
      loading={loading}
      error={loadError}
      notFound={notFound}
      onRetry={() => setReloadRevision((value) => value + 1)}
      onBack={returnToSource}
      actions={
        <>
          {role ? (
            <PermissionButton type="primary" permission="role" onClick={() => navigateWithReturn(`/roles/${role.id}/edit`)}>
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
                returnToSource();
              }}
              successMessage={false}
            >
              删除
            </DeleteConfirmAction>
          ) : null}
        </>
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
                { label: '权限范围', value: role.permissions || '-', aggregate: true },
                { label: '角色描述', value: role.description || '-', wide: true, longText: true }
              ]}
            />
          </TemplateDetailSection>
          <TemplateDetailSection title="菜单权限">
            <AdminTree
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
