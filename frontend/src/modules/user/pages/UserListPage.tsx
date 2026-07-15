import { useEffect, useMemo, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import {
  ActionBar,
  AdminInput,
  AdminSelect,
  AdminTextAction,
  CompactFilterBar,
  ConfirmAction,
  createListFilterItems,
  createListSorters,
  DetailLinkCell,
  listRouteCodecs,
  listSorters,
  OperationColumnActions,
  PermissionButton,
  StatusTag,
  StatusConfirmAction,
  TemplateListPage,
  useCommittedFilters,
  usePageReturnNavigation,
  useTemplateServerListData
} from '../../../components/admin';
import { getUserList, resetUserPassword, toggleUserStatus } from '../../../api/userApi';
import { getRoleOptions } from '../../../api/roleApi';
import type { UserRecord } from '../types';

type UserFilters = {
  employeeNo: string;
  realName: string;
  phone: string;
  roleIds: string[];
  status?: UserRecord['status'];
};

const defaultFilters: UserFilters = {
  employeeNo: '',
  realName: '',
  phone: '',
  roleIds: [],
  status: undefined
};

const userSorters = createListSorters<UserRecord>({
  employeeNo: listSorters.text((row) => row.employeeNo),
  realName: listSorters.text((row) => row.realName),
  phone: listSorters.text((row) => row.phone),
  roleName: listSorters.text((row) => row.roleName),
  status: listSorters.text((row) => row.status),
  creatorName: listSorters.text((row) => row.creatorName),
  createdAt: listSorters.date((row) => row.createdAt)
});

export function UserListPage() {
  const { navigateWithReturn } = usePageReturnNavigation('/users');
  const { draftFilters, appliedFilters, revision: filterRevision, setDraftFilters, commitFilters, resetFilters } = useCommittedFilters(defaultFilters, {
    urlSync: true,
    codecs: { roleIds: listRouteCodecs.stringArray, status: listRouteCodecs.string }
  });
  const [roleOptions, setRoleOptions] = useState<Array<{ label: string; value: string }>>([]);

  const {
    pagedRows,
    sortState,
    pagination,
    handleTableChange,
    renderIndex,
    loading,
    error,
    reload
  } = useTemplateServerListData({
    queryKey: ['users', appliedFilters, filterRevision],
    request: ({ current, pageSize, sortField, sortOrder }) => getUserList({
      ...appliedFilters,
      current,
      pageSize,
      sortField,
      sortOrder
    }),
    sorters: userSorters,
    urlSync: true
  });

  useEffect(() => {
    getRoleOptions().then(setRoleOptions);
  }, []);

  const filterItems = createListFilterItems([
    {
      key: 'employeeNo',
      label: '工号',
      node: (
        <AdminInput
          size="small"
          value={draftFilters.employeeNo}
          placeholder="请输入"
          onChange={(event) => setDraftFilters((prev) => ({ ...prev, employeeNo: event.target.value }))}
          onPressEnter={() => {
            commitFilters();
          }}
        />
      )
    },
    {
      key: 'realName',
      label: '姓名',
      node: (
        <AdminInput
          size="small"
          value={draftFilters.realName}
          placeholder="请输入"
          onChange={(event) => setDraftFilters((prev) => ({ ...prev, realName: event.target.value }))}
          onPressEnter={() => {
            commitFilters();
          }}
        />
      )
    },
    {
      key: 'phone',
      label: '手机号',
      node: (
        <AdminInput
          size="small"
          value={draftFilters.phone}
          placeholder="请输入"
          onChange={(event) => setDraftFilters((prev) => ({ ...prev, phone: event.target.value }))}
          onPressEnter={() => {
            commitFilters();
          }}
        />
      )
    },
    {
      key: 'roleIds',
      label: '角色',
      node: (
        <AdminSelect
          size="small"
          mode="multiple"
          maxTagCount="responsive"
          value={draftFilters.roleIds}
          placeholder="请选择角色"
          options={roleOptions}
          onChange={(value) => setDraftFilters((prev) => ({ ...prev, roleIds: value }))}
        />
      )
    },
    {
      key: 'status',
      label: '状态',
      node: (
        <AdminSelect
          size="small"
          value={draftFilters.status}
          placeholder="全部"
          options={[
            { label: '启用', value: 'enabled' },
            { label: '停用', value: 'disabled' }
          ]}
          onChange={(value) => setDraftFilters((prev) => ({ ...prev, status: value }))}
        />
      )
    }
  ]);

  const columns: ProColumns<UserRecord>[] = [
    {
      title: '序号',
      width: 56,
      fixed: 'left',
      hideInSetting: true,
      search: false,
      render: (_, __, index) => renderIndex(index)
    },
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 140,
      fixed: 'left',
      sorter: true,
      sortOrder: sortState.field === 'employeeNo' ? sortState.order : null,
      render: (_, record) => (
        <DetailLinkCell onClick={() => navigateWithReturn(`/users/${record.id}`)}>
          {record.employeeNo}
        </DetailLinkCell>
      )
    },
    {
      title: '姓名',
      dataIndex: 'realName',
      width: 140,
      sorter: true,
      sortOrder: sortState.field === 'realName' ? sortState.order : null
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      width: 140,
      sorter: true,
      sortOrder: sortState.field === 'phone' ? sortState.order : null
    },
    {
      title: '角色',
      dataIndex: 'roleName',
      width: 160,
      ellipsis: true,
      sorter: true,
      sortOrder: sortState.field === 'roleName' ? sortState.order : null
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      sorter: true,
      sortOrder: sortState.field === 'status' ? sortState.order : null,
      render: (_, record) => <StatusTag status={record.status} />
    },
    {
      title: '创建人',
      dataIndex: 'creatorName',
      width: 120,
      sorter: true,
      sortOrder: sortState.field === 'creatorName' ? sortState.order : null
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 170,
      sorter: true,
      sortOrder: sortState.field === 'createdAt' ? sortState.order : null
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <OperationColumnActions>
          <AdminTextAction onClick={() => navigateWithReturn(`/users/${record.id}/edit`)}>
            编辑
          </AdminTextAction>
          <StatusConfirmAction
            variant="text"
            action={record.status === 'enabled' ? 'disable' : 'enable'}
            entityName="用户"
            targetName={record.realName}
            onConfirm={async () => {
              await toggleUserStatus(record.id, record.status === 'enabled' ? 'disabled' : 'enabled');
              await reload();
            }}
          >
            {record.status === 'enabled' ? '停用' : '启用'}
          </StatusConfirmAction>
          <ConfirmAction
            variant="text"
            title="确认重置密码"
            description={`确定要重置 ${record.realName} 的密码吗？重置后密码为 vv123456。`}
            onConfirm={async () => {
              await resetUserPassword(record.id);
            }}
          >
            重置密码
          </ConfirmAction>
        </OperationColumnActions>
      )
    }
  ];

  return (
    <TemplateListPage<UserRecord>
      error={error}
      onRetry={reload}
      title="用户管理"
      actions={
        <ActionBar>
          <PermissionButton type="primary" permission="user" onClick={() => navigateWithReturn('/users/new')}>
            新增用户
          </PermissionButton>
        </ActionBar>
      }
      filter={(
        <CompactFilterBar
          items={filterItems}
          visibleCount={4}
          onSearch={() => {
            commitFilters();
          }}
          onReset={() => {
            resetFilters();
          }}
        />
      )}
      table={{
        columns,
        dataSource: pagedRows,
        loading,
        pagination: false,
        search: false,
        onChange: handleTableChange,
        tableAlertRender: false,
        scroll: { x: 1200 }
      }}
      pagination={pagination}
    />
  );
}
