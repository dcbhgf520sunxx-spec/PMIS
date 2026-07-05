import { useEffect, useState } from 'react';
import { Button, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ActionBar,
  DetailMetaList,
  PermissionButton,
  StatusConfirmAction,
  StatusTag,
  TemplateDetailPage,
  TemplateDetailSection
} from '../../../components/admin';
import { getUser, toggleUserStatus } from '../../../api/userApi';
import type { UserRecord } from '../types';

export function UserDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [user, setUser] = useState<UserRecord>();

  useEffect(() => {
    if (!params.id) return;
    getUser(params.id).then(setUser);
  }, [params.id]);

  return (
    <TemplateDetailPage
      title="用户详情"
      loading={!user}
      actions={
        <ActionBar>
          <Button onClick={() => navigate('/users')}>返回</Button>
          {user ? (
            <PermissionButton type="primary" permission="user" onClick={() => navigate(`/users/${user.id}/edit`)}>
              编辑
            </PermissionButton>
          ) : null}
          {user ? (
            <StatusConfirmAction
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
        </ActionBar>
      }
      statusSection={user ? {
        items: [
          { label: '状态', value: <StatusTag status={user.status} />, wide: true }
        ]
      } : null}
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
