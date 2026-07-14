import { useEffect, useState } from 'react';
import { message } from 'antd';
import { useParams } from 'react-router-dom';
import {
  DetailMetaList,
  PermissionButton,
  StatusConfirmAction,
  StatusTag,
  TemplateDetailPage,
  TemplateDetailSection,
  usePageReturnNavigation
} from '../../../components/admin';
import { getUser, toggleUserStatus } from '../../../api/userApi';
import type { UserRecord } from '../types';

export function UserDetailPage() {
  const { navigateWithReturn, returnToSource } = usePageReturnNavigation('/users');
  const params = useParams();
  const [user, setUser] = useState<UserRecord>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [reloadRevision, setReloadRevision] = useState(0);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    setLoadError('');
    setNotFound(false);
    setUser(undefined);
    getUser(params.id)
      .then(setUser)
      .catch((error) => {
        const messageText = error instanceof Error ? error.message : '用户加载失败';
        if (messageText.includes('不存在')) setNotFound(true);
        else setLoadError(messageText);
      })
      .finally(() => setLoading(false));
  }, [params.id, reloadRevision]);

  return (
    <TemplateDetailPage
      title="用户详情"
      loading={loading}
      error={loadError}
      notFound={notFound}
      onRetry={() => setReloadRevision((value) => value + 1)}
      onBack={returnToSource}
      actions={
        user ? (
          <PermissionButton type="primary" permission="user" onClick={() => navigateWithReturn(`/users/${user.id}/edit`)}>
            编辑
          </PermissionButton>
        ) : null
      }
      statusSection={user ? {
        items: [
          { label: '状态', value: <StatusTag status={user.status} />, wide: true }
        ]
      } : null}
      statusAction={user ? (
        <StatusConfirmAction
          block
          action={user.status === 'enabled' ? 'disable' : 'enable'}
          entityName="用户"
          targetName={user.realName}
          onConfirm={async () => {
            const nextStatus = user.status === 'enabled' ? 'disabled' : 'enabled';
            await toggleUserStatus(user.id, nextStatus);
            setUser({ ...user, status: nextStatus });
            message.success(`${nextStatus === 'enabled' ? '启用' : '停用'}成功`);
          }}
          successMessage={false}
        >
          {user.status === 'enabled' ? '停用' : '启用'}
        </StatusConfirmAction>
      ) : null}
      documentSection={user ? {
        items: [
          { label: '创建人', value: user.creatorName || '-' },
          { label: '创建时间', value: user.createdAt || '-', wide: true },
          { label: '更新人', value: user.updaterName || '-' },
          { label: '更新时间', value: user.updatedAt || '-', wide: true }
        ]
      } : null}
    >
      {user ? (
        <TemplateDetailSection title="基本信息">
          <DetailMetaList
            items={[
              { label: '工号', value: user.employeeNo },
              { label: '姓名', value: user.realName || '-' },
              { label: '手机号', value: user.phone || '-' },
              { label: '所属角色', value: user.roleName || '-' }
            ]}
          />
        </TemplateDetailSection>
      ) : null}
    </TemplateDetailPage>
  );
}
