import { useEffect, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { App } from 'antd';
import { ActionBar, AdminInput, AdminRangePicker, AdminSelect, AdminTextAction, CompactFilterBar, createListFilterItems, DeleteConfirmAction, DetailLinkCell, OperationColumnActions, PermissionButton, TemplateListPage, useCommittedFilters, useTemplateServerListData, ViewTabs , listRouteCodecs, useListViewState, usePageReturnNavigation } from '../../../components/admin';
import { deleteProject, getProjectList, updateProjectStatus } from '../../../api/projectApi';
import { getProductOptions } from '../../../api/productApi';
import { getUserOptions } from '../../../api/userApi';
import { useAuthStore } from '../../../stores/authStore';
import type { ProjectRecord, ProjectStatus } from '../types';
import { renderProjectOverdue } from '../helpers';
import { ProjectStatusChangeAction, renderProjectStatus } from '../components/ProjectStatusChangeAction';
import './ProjectListPage.css';

const statusText = (status: ProjectStatus) => ['未启动', '进行中', '已完成', '暂停'][status];
const statusOptions = ([0, 1, 2, 3] as ProjectStatus[]).map((value) => ({ label: statusText(value), value }));
const dateValue = (value: unknown) => value && typeof value === 'object' && 'format' in value && typeof value.format === 'function' ? value.format('YYYY-MM-DD') : undefined;
const defaults = { name: '', productId: undefined as string | undefined, ownerId: undefined as string | undefined, memberIds: [] as string[], status: undefined as number | undefined, isOverdue: undefined as number | undefined, expectedEndDateRange: [] as unknown[] };

export function ProjectListPage() {
  const { navigateWithReturn: navigate } = usePageReturnNavigation('/projects'); const currentUser = useAuthStore((state) => state.user); const { message } = App.useApp();
  const [view, setView] = useListViewState<'all' | 'mine' | 'joined'>('mine', ['all', 'mine', 'joined'], true);
  const [products, setProducts] = useState<Array<{ label: string; value: string }>>([]); const [users, setUsers] = useState<Array<{ label: string; value: string }>>([]);
  const filters = useCommittedFilters(defaults, { urlSync: true, codecs: { name: listRouteCodecs.string, productId: listRouteCodecs.string, ownerId: listRouteCodecs.string, memberIds: listRouteCodecs.stringArray, status: listRouteCodecs.number, isOverdue: listRouteCodecs.number, expectedEndDateRange: listRouteCodecs.dateArray } });
  const list = useTemplateServerListData<ProjectRecord, { viewCounts: { all: number; mine: number; joined: number } }>({
    queryKey: ['projects', filters.appliedFilters, currentUser?.id, filters.revision, view],
    request: async ({ current, pageSize, sortField, sortOrder }) => {
      const expectedRange = filters.appliedFilters.expectedEndDateRange || [];
      const result = await getProjectList({ name: filters.appliedFilters.name || undefined, product_id: filters.appliedFilters.productId, filter_owner_id: filters.appliedFilters.ownerId, owner_id: view === 'mine' ? currentUser?.id : filters.appliedFilters.ownerId, joined_user_id: view === 'joined' ? currentUser?.id : undefined, current_user_id: currentUser?.id, member_ids: filters.appliedFilters.memberIds.join(',') || undefined, status: filters.appliedFilters.status, is_overdue: filters.appliedFilters.isOverdue, expected_end_date_from: dateValue(expectedRange[0]), expected_end_date_to: dateValue(expectedRange[1]), page: current, pageSize, sort_field: sortField, sort_order: sortOrder });
      return { list: result.list, total: result.total, meta: { viewCounts: result.viewCounts } };
    },
    urlSync: true
  });
  const load = list.reload;
  const viewCounts = list.meta?.viewCounts ?? { all: 0, mine: 0, joined: 0 };
  useEffect(() => { getProductOptions().then((items) => setProducts(items.filter((item) => item.status === 1))); getUserOptions().then(setUsers); }, []);
  const columns: ProColumns<ProjectRecord>[] = [
    { title: '序号', width: 60, fixed: 'left', render: (_, __, index) => list.renderIndex(index) },
    { title: '项目名称', dataIndex: 'name', width: 230, fixed: 'left', sorter: true, sortOrder: list.sortState.field === 'name' ? list.sortState.order : null, render: (_, row) => <div className="project-name-cell"><DetailLinkCell className="project-name-cell__text" title={row.name} onClick={() => navigate(`/projects/${row.id}`)}>{row.name}</DetailLinkCell>{row.isOverdue ? <span className="project-name-cell__tag">{renderProjectOverdue(true, row.expectedEndDate)}</span> : null}</div> },
    { title: '所属产品', dataIndex: 'productName', width: 150, sorter: true, sortOrder: list.sortState.field === 'productName' ? list.sortState.order : null }, { title: '负责人', dataIndex: 'ownerName', width: 120, sorter: true, sortOrder: list.sortState.field === 'ownerName' ? list.sortState.order : null },
    { title: '状态', dataIndex: 'status', width: 100, sorter: true, sortOrder: list.sortState.field === 'status' ? list.sortState.order : null, render: (_, row) => renderProjectStatus(row.status) },
    { title: '启动时间', dataIndex: 'startDate', width: 120, sorter: true, sortOrder: list.sortState.field === 'startDate' ? list.sortState.order : null, render: (_, row) => row.startDate || '-' },
    { title: '预计完成时间', dataIndex: 'expectedEndDate', width: 140, sorter: true, sortOrder: list.sortState.field === 'expectedEndDate' ? list.sortState.order : null }, { title: '项目成员', dataIndex: 'members', width: 180, ellipsis: true, sorter: true, sortOrder: list.sortState.field === 'members' ? list.sortState.order : null, render: (_, row) => row.members.map((member) => member.name).join('、') || '-' },
    { title: '创建人', dataIndex: 'creatorName', width: 110, sorter: true, sortOrder: list.sortState.field === 'creatorName' ? list.sortState.order : null }, { title: '创建时间', dataIndex: 'createdAt', width: 170, sorter: true, sortOrder: list.sortState.field === 'createdAt' ? list.sortState.order : null },
    { title: '操作', valueType: 'option', width: 190, fixed: 'right', render: (_, row) => <OperationColumnActions><AdminTextAction onClick={() => navigate(`/projects/${row.id}/edit`)}>编辑</AdminTextAction><ProjectStatusChangeAction variant="text" project={row} onConfirm={async (status, values) => { await updateProjectStatus(row.id, status, status === 2 ? { actual_end_date: dateValue(values.actualEndDate) } : status === 3 ? { suspend_date: dateValue(values.suspendDate) } : {}); message.success('状态更新成功'); await load(); }}>状态变更</ProjectStatusChangeAction><DeleteConfirmAction variant="text" entityName="项目" targetName={row.name} successMessage="删除成功" onConfirm={async () => { await deleteProject(row.id); await load(); }}>删除</DeleteConfirmAction></OperationColumnActions> }
  ];
  const items = createListFilterItems([
    { key: 'name', label: '项目名称', node: <AdminInput size="small" value={filters.draftFilters.name} onChange={(event) => filters.setDraftFilters((prev) => ({ ...prev, name: event.target.value }))} onPressEnter={filters.commitFilters} /> },
    { key: 'product', label: '所属产品', node: <AdminSelect size="small" value={filters.draftFilters.productId} options={products} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, productId: value }))} /> },
    { key: 'status', label: '状态', node: <AdminSelect size="small" value={filters.draftFilters.status} options={statusOptions} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, status: value }))} /> },
    { key: 'overdue', label: '逾期状态', node: <AdminSelect size="small" value={filters.draftFilters.isOverdue} options={[{ label: '已逾期', value: 1 }, { label: '未逾期', value: 0 }]} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, isOverdue: value }))} /> },
    { key: 'owner', label: '负责人', hidden: view === 'mine', node: <AdminSelect size="small" value={filters.draftFilters.ownerId} options={users} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, ownerId: value }))} /> },
    { key: 'members', label: '项目成员', node: <AdminSelect size="small" mode="multiple" value={filters.draftFilters.memberIds} options={users} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, memberIds: value }))} /> },
    { key: 'expectedEndDate', label: '预计完成时间', wide: true, node: <AdminRangePicker size="small" value={filters.draftFilters.expectedEndDateRange as never} placeholder={['开始时间', '结束时间']} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, expectedEndDateRange: value || [] }))} /> }
  ]);
  return <TemplateListPage<ProjectRecord> title="项目管理" error={list.error} onRetry={load} titleExtra={<ViewTabs showCounts value={view} onChange={setView} items={[{ label: '全部项目', value: 'all', count: viewCounts.all }, { label: '我负责的', value: 'mine', count: viewCounts.mine }, { label: '我参与的', value: 'joined', count: viewCounts.joined }]} />} actions={<ActionBar><PermissionButton permission="project" type="primary" onClick={() => navigate('/projects/new')}>新增项目</PermissionButton></ActionBar>} filter={<CompactFilterBar visibleCount={4} items={items} onSearch={filters.commitFilters} onReset={filters.resetFilters} />} table={{ columns, dataSource: list.pagedRows, loading: list.loading, pagination: false, search: false, onChange: list.handleTableChange, tableAlertRender: false, scroll: { x: 1550 } }} pagination={list.pagination} />;
}
