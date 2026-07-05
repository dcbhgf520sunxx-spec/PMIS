import { useEffect, useMemo, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { useNavigate } from 'react-router-dom';
import {
  ActionBar,
  AdminInput,
  AdminSelect,
  AdminTextAction,
  CompactFilterBar,
  ConfirmAction,
  DetailLinkCell,
  OperationColumnActions,
  PermissionButton,
  StatusTag,
  StatusConfirmAction,
  TemplateListPage,
  useCommittedFilters,
  useTemplateListPageData
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

const userSorters: Record<string, (a: UserRecord, b: UserRecord) => number> = {
  employeeNo: (a, b) => a.employeeNo.localeCompare(b.employeeNo),
  realName: (a, b) => a.realName.localeCompare(b.realName),
  phone: (a, b) => (a.phone || '').localeCompare(b.phone || ''),
  roleName: (a, b) => (a.roleName || '').localeCompare(b.roleName || ''),
  status: (a, b) => a.status.localeCompare(b.status),
  creatorName: (a, b) => (a.creatorName || '').localeCompare(b.creatorName || ''),
  createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt)
};

export function UserListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<UserRecord[]>([]);
  const { draftFilters, appliedFilters, setDraftFilters, commitFilters, resetFilters } = useCommittedFilters(defaultFilters);
  const [roleOptions, setRoleOptions] = useState<Array<{ label: string; value: string }>>([]);

  const loadRows = async () => {
    const result = await getUserList({ pageSize: 1000 });
    setRows(result.list);
  };

  useEffect(() => {
    loadRows();
    getRoleOptions().then(setRoleOptions);
  }, []);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchEmployeeNo = appliedFilters.employeeNo ? row.employeeNo.includes(appliedFilters.employeeNo) : true;
    const matchRealName = appliedFilters.realName ? row.realName.includes(appliedFilters.realName) : true;
    const matchPhone = appliedFilters.phone ? (row.phone || '').includes(appliedFilters.phone) : true;
    const matchRole = appliedFilters.roleIds.length > 0
      ? appliedFilters.roleIds.some((roleId) => row.roleIds?.includes(roleId))
      : true;
    const matchStatus = appliedFilters.status ? row.status === appliedFilters.status : true;
    return matchEmployeeNo && matchRealName && matchPhone && matchRole && matchStatus;
  }), [appliedFilters, rows]);

  const {
    currentPage,
    pageSize,
    pagedRows,
    sortState,
    total,
    setCurrentPage,
    setPageSize,
    handleTableChange,
    renderIndex
  } = useTemplateListPageData({ rows: filteredRows, sorters: userSorters });

  const filterItems = [
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
            setCurrentPage(1);
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
            setCurrentPage(1);
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
            setCurrentPage(1);
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
  ];

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
        <DetailLinkCell onClick={() => navigate(`/users/${record.id}`)}>
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
          <AdminTextAction onClick={() => navigate(`/users/${record.id}/edit`)}>
            编辑
          </AdminTextAction>
          <StatusConfirmAction
            variant="text"
            action={record.status === 'enabled' ? 'disable' : 'enable'}
            entityName="用户"
            targetName={record.realName}
            onConfirm={async () => {
              await toggleUserStatus(record.id, record.status === 'enabled' ? 'disabled' : 'enabled');
              await loadRows();
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
      title="用户管理"
      actions={
        <ActionBar>
          <PermissionButton type="primary" permission="user" onClick={() => navigate('/users/new')}>
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
            setCurrentPage(1);
          }}
          onReset={() => {
            resetFilters();
            setCurrentPage(1);
          }}
        />
      )}
      table={{
        columns,
        dataSource: pagedRows,
        pagination: false,
        search: false,
        onChange: handleTableChange,
        tableAlertRender: false,
        scroll: { x: 1200 }
      }}
      scrollYDeps={[total, currentPage, pageSize, pagedRows.length]}
      pagination={{
        current: currentPage,
        pageSize,
        total,
        onChange: (page, size) => {
          setCurrentPage(page);
          setPageSize(size);
        },
        onShowSizeChange: (_, size) => {
          setCurrentPage(1);
          setPageSize(size);
        }
      }}
    />
  );
}
