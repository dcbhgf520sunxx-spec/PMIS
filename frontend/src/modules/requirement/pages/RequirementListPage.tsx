import { useEffect, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { App } from 'antd';
import { ActionBar, AdminInput, AdminRangePicker, AdminSelect, AdminTextAction, CompactFilterBar, createDetailNeighborContext, createListFilterItems, DeleteConfirmAction, DetailLinkCell, OperationColumnActions, PermissionButton, saveDetailNeighborContext, TemplateListPage, useCommittedFilters, useTemplateServerListData, ViewTabs , listRouteCodecs, useListViewState, usePageReturnNavigation } from '../../../components/admin';
import { deleteRequirement, getProjectOptions, getRequirementList, updateRequirementStatus } from '../../../api/requirementApi';
import { getProductOptions } from '../../../api/productApi';
import { getUserOptions } from '../../../api/userApi';
import type { RequirementRecord, RequirementStatus, RequirementType } from '../types';
import { normalizeRequirementStatusForType, requirementStatusLabels, requirementStatusesForType, requirementTypeLabels } from '../statusTransitions';
import { renderRequirementStatus, RequirementStatusChangeAction } from '../components/RequirementStatusChangeAction';
import { renderRequirementOverdue, renderRequirementPriority } from '../helpers';
import './RequirementListPage.css';

const defaults = { title: '', requirementType: undefined as number | undefined, status: undefined as number | undefined, priority: undefined as number | undefined, isOverdue: undefined as number | undefined, productId: undefined as string|undefined, projectId: undefined as string|undefined, ownerId: undefined as string|undefined, submitterName: '', submitDateRange: [] as unknown[], expectedEndDateRange: [] as unknown[] };
const date = (value: any) => value && typeof value === 'object' && 'format' in value ? value.format('YYYY-MM-DD') : undefined;

export function RequirementListPage() {
  const { currentPath, navigateWithReturn: navigate } = usePageReturnNavigation('/requirements');
  const { message } = App.useApp();
  const [view, setView] = useListViewState<'all' | 'mine'>('mine', ['all', 'mine'], true);
  const [products,setProducts]=useState<any[]>([]),[projects,setProjects]=useState<any[]>([]),[users,setUsers]=useState<any[]>([]);
  const filters = useCommittedFilters(defaults, { urlSync: true, codecs: { title: listRouteCodecs.string, requirementType: listRouteCodecs.number, status: listRouteCodecs.number, priority: listRouteCodecs.number, isOverdue: listRouteCodecs.number, productId: listRouteCodecs.string, projectId: listRouteCodecs.string, ownerId: listRouteCodecs.string, submitterName: listRouteCodecs.string, submitDateRange: listRouteCodecs.dateArray, expectedEndDateRange: listRouteCodecs.dateArray } });
  const list = useTemplateServerListData<RequirementRecord, { viewCounts: { all: number; mine: number } }>({
    queryKey: ['requirements', filters.appliedFilters, filters.revision, view],
    request: async ({ current, pageSize, sortField, sortOrder }) => {
      const submitRange=filters.appliedFilters.submitDateRange||[],expectedRange=filters.appliedFilters.expectedEndDateRange||[];
      const result = await getRequirementList({ title:filters.appliedFilters.title||undefined, requirement_type: filters.appliedFilters.requirementType, status:filters.appliedFilters.status, priority:filters.appliedFilters.priority, is_overdue: filters.appliedFilters.isOverdue, product_id:filters.appliedFilters.productId, project_id:filters.appliedFilters.projectId, filter_owner_id:view==='all'?filters.appliedFilters.ownerId:undefined, owner_id:view==='all'?filters.appliedFilters.ownerId:undefined, submitter_name:filters.appliedFilters.submitterName||undefined, submit_date_from:date(submitRange[0]),submit_date_to:date(submitRange[1]),expected_end_date_from:date(expectedRange[0]),expected_end_date_to:date(expectedRange[1]), view, page: current, pageSize, sort_field: sortField, sort_order: sortOrder });
      return { list: result.list, total: result.total, meta: { viewCounts: result.viewCounts } };
    },
    urlSync: true
  });
  const load = list.reload;
  const counts = list.meta?.viewCounts ?? { all: 0, mine: 0 };
  useEffect(()=>{getProductOptions().then(items=>setProducts(items.filter(item=>item.status===1)));getProjectOptions().then(setProjects);getUserOptions().then(setUsers)},[]);
  const sortOrder = (field: string) => list.sortState.field === field ? list.sortState.order : null;
  const submitStatus = async (row: RequirementRecord, status: RequirementStatus, values: any) => {
    await updateRequirementStatus(row.id, status, status === 35 ? { pause_date: date(values.pauseDate) } : [33, 34].includes(status) ? { actual_end_date: date(values.actualEndDate), completion_status: values.completionStatus } : {});
    message.success('状态更新成功'); await load();
  };
  const openDetail=(row:RequirementRecord)=>{const submitRange=filters.appliedFilters.submitDateRange||[],expectedRange=filters.appliedFilters.expectedEndDateRange||[];saveDetailNeighborContext(createDetailNeighborContext({moduleKey:'requirement',routeBase:'/requirements',sourcePath:currentPath,params:{title:filters.appliedFilters.title||undefined,requirement_type:filters.appliedFilters.requirementType,status:filters.appliedFilters.status,priority:filters.appliedFilters.priority,is_overdue:filters.appliedFilters.isOverdue,product_id:filters.appliedFilters.productId,project_id:filters.appliedFilters.projectId,filter_owner_id:view==='all'?filters.appliedFilters.ownerId:undefined,submitter_name:filters.appliedFilters.submitterName||undefined,submit_date_from:date(submitRange[0]),submit_date_to:date(submitRange[1]),expected_end_date_from:date(expectedRange[0]),expected_end_date_to:date(expectedRange[1]),view,sort_field:list.sortState.field,sort_order:list.sortState.order}}));navigate(`/requirements/${row.id}`)};
  const columns: ProColumns<RequirementRecord>[] = [
    { title: '序号', width: 60, fixed: 'left', render: (_, __, index) => list.renderIndex(index) },
    { title: '需求标题', dataIndex: 'title', width: 240, fixed: 'left', sorter: true, sortOrder: sortOrder('title'), render: (_, row) => <div className="requirement-title-cell"><DetailLinkCell className="requirement-title-cell__text" title={row.title} onClick={() => openDetail(row)}>{row.title}</DetailLinkCell>{row.isOverdue ? <span className="requirement-title-cell__tag">{renderRequirementOverdue(true, row.expectedEndDate)}</span> : null}</div> },
    { title: '需求路径', dataIndex: 'requirementType', width: 110, sorter: true, sortOrder: sortOrder('requirementType'), render: (_, row) => requirementTypeLabels[row.requirementType] },
    { title: '状态', dataIndex: 'status', width: 120, sorter: true, sortOrder: sortOrder('status'), render: (_, row) => renderRequirementStatus(row.status) },
    { title: '所属产品', dataIndex: 'productName', width: 140, sorter: true, sortOrder: sortOrder('productName') },
    { title: '所属项目', dataIndex: 'projectName', width: 140, sorter: true, sortOrder: sortOrder('projectName') },
    { title: '负责人', dataIndex: 'ownerName', width: 110, sorter: true, sortOrder: sortOrder('ownerName') },
    { title: '优先级', dataIndex: 'priority', width: 90, sorter: true, sortOrder: sortOrder('priority'), render: (_, row) => renderRequirementPriority(row.priority) },
    { title: '提出人', dataIndex: 'submitterName', width: 100, sorter: true, sortOrder: sortOrder('submitterName') },
    { title: '提出时间', dataIndex: 'submitDate', width: 120, sorter: true, sortOrder: sortOrder('submitDate') },
    { title: '预计完成时间', dataIndex: 'expectedEndDate', width: 140, sorter: true, sortOrder: sortOrder('expectedEndDate'), render: (_, row) => row.expectedEndDate || '-' },
    { title: '创建人', dataIndex: 'creatorName', width: 100, sorter: true, sortOrder: sortOrder('creatorName') },
    { title: '创建时间', dataIndex: 'createdAt', width: 170, sorter: true, sortOrder: sortOrder('createdAt') },
    { title: '操作', valueType: 'option', width: 190, fixed: 'right', render: (_, row) => <OperationColumnActions><AdminTextAction onClick={() => navigate(`/requirements/${row.id}/edit`)}>编辑</AdminTextAction><RequirementStatusChangeAction variant="text" requirement={row} onConfirm={(status, values) => submitStatus(row, status, values)}>状态变更</RequirementStatusChangeAction><AdminTextAction onClick={() => navigate(`/requirements/${row.id}/copy`)}>复制</AdminTextAction><DeleteConfirmAction variant="text" entityName="需求" targetName={row.title} successMessage="删除成功" onConfirm={async () => { await deleteRequirement(row.id); await load(); }}>删除</DeleteConfirmAction></OperationColumnActions> }
  ];
  const statusOptions=requirementStatusesForType(filters.draftFilters.requirementType as RequirementType|undefined).map(value=>({value,label:requirementStatusLabels[value]}));
  const items = createListFilterItems([
    { key: 'title', label: '需求标题', node: <AdminInput size="small" value={filters.draftFilters.title} onChange={(event) => filters.setDraftFilters((prev) => ({ ...prev, title: event.target.value }))} onPressEnter={filters.commitFilters} /> },
    { key: 'type', label: '需求路径', node: <AdminSelect size="small" value={filters.draftFilters.requirementType} options={Object.entries(requirementTypeLabels).map(([value, label]) => ({ value: Number(value), label }))} onChange={(value) => filters.setDraftFilters((prev) => {const requirementType=value as RequirementType|undefined;return{...prev,requirementType,status:normalizeRequirementStatusForType(requirementType,prev.status as RequirementStatus|undefined)}})} /> },
    { key: 'status', label: '状态', node: <AdminSelect size="small" value={filters.draftFilters.status} options={statusOptions} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, status: value }))} /> },
    { key: 'ownerId', label: '负责人', hidden: view !== 'all', node: <AdminSelect size="small" value={filters.draftFilters.ownerId} options={users} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, ownerId: value }))} /> },
    { key: 'priority', label: '优先级', node: <AdminSelect size="small" value={filters.draftFilters.priority} options={[{ label: '低', value: 0 }, { label: '中', value: 1 }, { label: '高', value: 2 }]} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, priority: value }))} /> },
    { key: 'overdue', label: '逾期状态', node: <AdminSelect size="small" value={filters.draftFilters.isOverdue} options={[{ label: '已逾期', value: 1 }, { label: '未逾期', value: 0 }]} onChange={(value) => filters.setDraftFilters((prev) => ({ ...prev, isOverdue: value }))} /> }
    ,{key:'productId',label:'所属产品',node:<AdminSelect size="small" value={filters.draftFilters.productId} options={products} onChange={value=>filters.setDraftFilters(prev=>({...prev,productId:value,projectId:undefined}))}/>}
    ,{key:'projectId',label:'所属项目',node:<AdminSelect size="small" value={filters.draftFilters.projectId} options={projects.filter(project=>!filters.draftFilters.productId||project.productId===filters.draftFilters.productId)} onChange={value=>filters.setDraftFilters(prev=>({...prev,projectId:value}))}/>}
    ,{key:'submitterName',label:'提出人',node:<AdminInput size="small" value={filters.draftFilters.submitterName} onChange={event=>filters.setDraftFilters(prev=>({...prev,submitterName:event.target.value}))} onPressEnter={filters.commitFilters}/>}
    ,{key:'submitDateRange',label:'提出时间',wide:true,node:<AdminRangePicker size="small" value={filters.draftFilters.submitDateRange as never} onChange={value=>filters.setDraftFilters(prev=>({...prev,submitDateRange:value||[]}))}/>}
    ,{key:'expectedEndDateRange',label:'预计完成时间',wide:true,node:<AdminRangePicker size="small" value={filters.draftFilters.expectedEndDateRange as never} onChange={value=>filters.setDraftFilters(prev=>({...prev,expectedEndDateRange:value||[]}))}/>}
  ]);
  return <TemplateListPage<RequirementRecord> title="需求管理" error={list.error} onRetry={load} titleExtra={<ViewTabs showCounts value={view} onChange={setView} items={[{ label: '全部需求', value: 'all', count: counts.all }, { label: '我负责的', value: 'mine', count: counts.mine }]} />} actions={<ActionBar><PermissionButton permission="requirement" type="primary" onClick={() => navigate('/requirements/new')}>新增需求</PermissionButton></ActionBar>} filter={<CompactFilterBar visibleCount={4} items={items} onSearch={filters.commitFilters} onReset={filters.resetFilters} />} table={{ columns, dataSource: list.pagedRows, loading: list.loading, pagination: false, search: false, onChange: list.handleTableChange, tableAlertRender: false, scroll: { x: 1870 } }} pagination={list.pagination} />;
}
