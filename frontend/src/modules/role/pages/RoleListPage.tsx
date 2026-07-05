import { useEffect, useMemo, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { useNavigate } from 'react-router-dom';
import {
  ActionBar,
  AdminInput,
  AdminTextAction,
  CompactFilterBar,
  DeleteConfirmAction,
  DetailLinkCell,
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

const roleSorters: Record<string, (a: RoleRecord, b: RoleRecord) => number> = {
  code: (a, b) => a.code.localeCompare(b.code),
  name: (a, b) => a.name.localeCompare(b.name),
  permissions: (a, b) => (a.permissions || '').localeCompare(b.permissions || ''),
  description: (a, b) => (a.description || '').localeCompare(b.description || ''),
  createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt)
};

export function RoleListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RoleRecord[]>([]);
  const { draftFilters, appliedFilters, setDraftFilters, commitFilters, resetFilters } = useCommittedFilters(defaultFilters);

  const loadRows = async () => {
    const result = await getRoleList({ pageSize: 1000 });
    setRows(result.list);
  };

  useEffect(() => {
    loadRows();
  }, []);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchCode = appliedFilters.code ? row.code.includes(appliedFilters.code) : true;
    const matchName = appliedFilters.name ? row.name.includes(appliedFilters.name) : true;
    return matchCode && matchName;
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
  } = useTemplateListPageData({ rows: filteredRows, sorters: roleSorters });

  const filterItems = [
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
            setCurrentPage(1);
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
            setCurrentPage(1);
          }}
        />
      )
    }
  ];

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
      ellipsis: true
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
