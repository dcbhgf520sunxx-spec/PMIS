import { useEffect, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { useNavigate } from 'react-router-dom';
import {
  ActionBar, AdminInput, AdminSelect, AdminTextAction, CompactFilterBar,
  DeleteConfirmAction, DetailLinkCell, OperationColumnActions, PermissionButton,
  StatusConfirmAction, StatusTag, TemplateListPage, useCommittedFilters,
  useTemplateListPageData
} from '../../../components/admin';
import { deleteProduct, getProductList, updateProductStatus } from '../../../api/productApi';
import { getUserOptions } from '../../../api/userApi';
import type { ProductRecord } from '../types';

const defaults = { name: '', ownerIds: [] as string[], status: undefined as number | undefined };

export function ProductListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ProductRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<Array<{ label: string; value: string }>>([]);
  const filters = useCommittedFilters(defaults);
  const list = useTemplateListPageData({ rows, total, serverPaging: true, resetOn: [filters.revision] });

  const load = async () => {
    const result = await getProductList({
      name: filters.appliedFilters.name || undefined,
      owner_ids: filters.appliedFilters.ownerIds.join(',') || undefined,
      status: filters.appliedFilters.status,
      page: list.currentPage,
      pageSize: list.pageSize,
      sort_field: list.sortState.field,
      sort_order: list.sortState.order
    });
    setRows(result.list);
    setTotal(result.total);
  };

  useEffect(() => { load(); }, [filters.appliedFilters, list.currentPage, list.pageSize, list.sortState.field, list.sortState.order]);
  useEffect(() => { getUserOptions().then(setUsers); }, []);

  const columns: ProColumns<ProductRecord>[] = [
    { title: '序号', width: 60, fixed: 'left', render: (_, __, index) => list.renderIndex(index) },
    { title: '产品名称', dataIndex: 'name', width: 220, fixed: 'left', sorter: true, sortOrder: list.sortState.field === 'name' ? list.sortState.order : null, render: (_, row) => <DetailLinkCell onClick={() => navigate(`/products/${row.id}`)}>{row.name}</DetailLinkCell> },
    { title: '负责人', dataIndex: 'ownerName', width: 130, sorter: true, sortOrder: list.sortState.field === 'ownerName' ? list.sortState.order : null },
    { title: '产品描述', dataIndex: 'description', width: 260, ellipsis: true, sorter: true, sortOrder: list.sortState.field === 'description' ? list.sortState.order : null, render: (_, row) => row.description || '-' },
    { title: '状态', dataIndex: 'status', width: 100, sorter: true, sortOrder: list.sortState.field === 'status' ? list.sortState.order : null, render: (_, row) => <StatusTag status={row.status === 1 ? 'enabled' : 'disabled'} /> },
    { title: '创建人', dataIndex: 'creatorName', width: 120, sorter: true, sortOrder: list.sortState.field === 'creatorName' ? list.sortState.order : null },
    { title: '创建时间', dataIndex: 'createdAt', width: 170, sorter: true, sortOrder: list.sortState.field === 'createdAt' ? list.sortState.order : null },
    {
      title: '操作', valueType: 'option', width: 170, fixed: 'right',
      render: (_, row) => (
        <OperationColumnActions>
          <AdminTextAction onClick={() => navigate(`/products/${row.id}/edit`)}>编辑</AdminTextAction>
          <StatusConfirmAction variant="text" action={row.status === 1 ? 'disable' : 'enable'} entityName="产品" targetName={row.name} onConfirm={async () => { await updateProductStatus(row.id, row.status === 1 ? 0 : 1); await load(); }}>{row.status === 1 ? '停用' : '启用'}</StatusConfirmAction>
          <DeleteConfirmAction variant="text" entityName="产品" targetName={row.name} successMessage="删除成功" onConfirm={async () => { await deleteProduct(row.id); await load(); }}>删除</DeleteConfirmAction>
        </OperationColumnActions>
      )
    }
  ];

  return (
    <TemplateListPage<ProductRecord>
      title="产品管理"
      actions={<ActionBar><PermissionButton permission="product" type="primary" onClick={() => navigate('/products/new')}>新增产品</PermissionButton></ActionBar>}
      filter={<CompactFilterBar items={[
        { key: 'name', label: '产品名称', node: <AdminInput size="small" value={filters.draftFilters.name} onChange={(event) => filters.setDraftFilters((prev) => ({ ...prev, name: event.target.value }))} onPressEnter={filters.commitFilters} /> },
        { key: 'owner', label: '负责人', node: <AdminSelect size="small" mode="multiple" value={filters.draftFilters.ownerIds} options={users} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, ownerIds: value }))} /> },
        { key: 'status', label: '状态', node: <AdminSelect size="small" value={filters.draftFilters.status} options={[{ label: '启用', value: 1 }, { label: '停用', value: 0 }]} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, status: value }))} /> }
      ]} onSearch={filters.commitFilters} onReset={filters.resetFilters} />}
      table={{ columns, dataSource: list.pagedRows, pagination: false, search: false, onChange: list.handleTableChange, tableAlertRender: false, scroll: { x: 1240 } }}
      pagination={list.pagination}
    />
  );
}
