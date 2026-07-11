import { useEffect, useMemo, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { useNavigate } from 'react-router-dom';
import {
  ActionBar,
  AdminInput,
  AdminTextAction,
  CompactFilterBar,
  createListFilterItems,
  createListSorters,
  DeleteConfirmAction,
  DetailLinkCell,
  listSorters,
  OperationColumnActions,
  PermissionButton,
  TemplateListPage,
  useCommittedFilters,
  useTemplateListPageData
} from '../../../components/admin';
import { deleteRole, getRoleList, type RoleRecord } from '../../../api/roleApi';

type RoleFilters = {
  code: string;
  name: string;
};

const defaultFilters: RoleFilters = {
  code: '',
  name: ''
};

const roleSorters = createListSorters<RoleRecord>({
  code: listSorters.text((row) => row.code),
  name: listSorters.text((row) => row.name),
  permissions: listSorters.text((row) => row.permissions),
  description: listSorters.text((row) => row.description),
  creatorName: listSorters.text((row) => row.creatorName),
  createdAt: listSorters.date((row) => row.createdAt)
});

export function RoleListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RoleRecord[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const { draftFilters, appliedFilters, revision: filterRevision, setDraftFilters, commitFilters, resetFilters } = useCommittedFilters(defaultFilters);

  const {
    currentPage,
    pageSize,
    pagedRows,
    sortState,
    total,
    pagination,
    handleTableChange,
    renderIndex
  } = useTemplateListPageData({ rows, sorters: roleSorters, resetOn: [filterRevision], total: serverTotal, serverPaging: true });

  const loadRows = async () => {
    const result = await getRoleList({
      ...appliedFilters,
      current: currentPage,
      pageSize,
      sortField: sortState.field,
      sortOrder: sortState.order || undefined
    });
    setRows(result.list);
    setServerTotal(result.total);
  };

  useEffect(() => {
    loadRows();
  }, [appliedFilters, currentPage, pageSize, sortState.field, sortState.order]);

  const filterItems = createListFilterItems([
    {
      key: 'code',
      label: '角色编码',
      node: (
        <AdminInput
          size="small"
          value={draftFilters.code}
          placeholder="请输入"
          onChange={(event) => setDraftFilters((prev) => ({ ...prev, code: event.target.value }))}
          onPressEnter={() => {
            commitFilters();
          }}
        />
      )
    },
    {
      key: 'name',
      label: '角色名称',
      node: (
        <AdminInput
          size="small"
          value={draftFilters.name}
          placeholder="请输入"
          onChange={(event) => setDraftFilters((prev) => ({ ...prev, name: event.target.value }))}
          onPressEnter={() => {
            commitFilters();
          }}
        />
      )
    }
  ]);

  const columns: ProColumns<RoleRecord>[] = [
    {
      title: '序号',
      width: 56,
      fixed: 'left',
      hideInSetting: true,
      search: false,
      render: (_, __, index) => renderIndex(index)
    },
    {
      title: '角色编码',
      dataIndex: 'code',
      width: 140,
      fixed: 'left',
      sorter: true,
      sortOrder: sortState.field === 'code' ? sortState.order : null,
      render: (_, record) => (
        <DetailLinkCell onClick={() => navigate(`/roles/${record.id}`)}>
          {record.code}
        </DetailLinkCell>
      )
    },
    {
      title: '角色名称',
      dataIndex: 'name',
      width: 160,
      sorter: true,
      sortOrder: sortState.field === 'name' ? sortState.order : null
    },
    {
      title: '权限范围',
      dataIndex: 'permissions',
      width: 260,
      ellipsis: true,
      sorter: true,
      sortOrder: sortState.field === 'permissions' ? sortState.order : null
    },
    {
      title: '角色描述',
      dataIndex: 'description',
      width: 260,
      ellipsis: true,
      sorter: true,
      sortOrder: sortState.field === 'description' ? sortState.order : null
    },
    {
      title: '创建人',
      dataIndex: 'creatorName',
      width: 120,
      ellipsis: true,
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
          <AdminTextAction onClick={() => navigate(`/roles/${record.id}/edit`)}>
            编辑
          </AdminTextAction>
          <DeleteConfirmAction
            variant="text"
            permission="role"
            entityName="角色"
            targetName={record.name}
            onConfirm={async () => {
              await deleteRole(record.id);
              await loadRows();
            }}
          >
            删除
          </DeleteConfirmAction>
        </OperationColumnActions>
      )
    }
  ];

  return (
    <TemplateListPage<RoleRecord>
      title="角色管理"
      actions={
        <ActionBar>
          <PermissionButton type="primary" permission="role" onClick={() => navigate('/roles/new')}>
            新增角色
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
