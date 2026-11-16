import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProColumns } from '@ant-design/pro-components';
import { AdminButton, AdminInput, AdminSelect, AdminTextAction, CompactFilterBar, ConfirmAction, createListSorters, DetailLinkCell, listSorters, OperationColumnActions, StatusConfirmAction, StatusTag, TemplateListPage, useCommittedFilters, usePageReturnNavigation, useTemplateListPageData } from '../../../components/admin';
import { listModelConnections, setModelConnectionStatus, setDefaultModelConnection, type ModelConnection } from '../../../api/modelConnectionApi';
import { ModelTestDialog } from '../components/ModelTestDialog';
const modelConnectionSorters = createListSorters<ModelConnection>({
    name: listSorters.text(row => row.name),
    provider: listSorters.text(row => row.provider),
    modelName: listSorters.text(row => row.modelName),
    isDefault: listSorters.number(row => row.isDefault),
    enabled: listSorters.number(row => row.enabled),
    creatorName: listSorters.text(row => row.creatorName),
    createdAt: listSorters.date(row => row.createdAt),
});
export function ModelConnectionListPage() {
    const nav = usePageReturnNavigation('/model-connections');
    const cache = useQueryClient();
    const [testing, setTesting] = useState('');
    const query = useQuery({ queryKey: ['model-connections'], queryFn: ({signal}) => listModelConnections(signal), refetchOnWindowFocus: false });
    const filters = useCommittedFilters({ keyword: '', enabled: '' }, { urlSync: true });
    const data = useTemplateListPageData({ rows: (query.data || []).filter(row => `${row.name} ${row.provider} ${row.modelName}`.includes(filters.appliedFilters.keyword.trim()) && (!filters.appliedFilters.enabled || String(row.enabled) === filters.appliedFilters.enabled)), sorters: modelConnectionSorters, urlSync: true });
    const refresh = () => { void query.refetch(); void cache.invalidateQueries({queryKey:['digital-twin','ai-summary']}); };
    const columns: ProColumns<ModelConnection>[] = [
        { title: '序号', width: 60, fixed: 'left', render: (_,__,i) => data.renderIndex(i) },
        { title: '接入名称', dataIndex: 'name', sorter: true, sortOrder: data.sortState.field === 'name' ? data.sortState.order : null, width: 190, fixed: 'left', render: (_,row) => <DetailLinkCell onClick={() => nav.navigateWithReturn(`/model-connections/${row.id}`)}>{row.name}</DetailLinkCell> },
        { title: '供应商', dataIndex: 'provider', sorter: true, sortOrder: data.sortState.field === 'provider' ? data.sortState.order : null, width: 130 },
        { title: '模型', dataIndex: 'modelName', sorter: true, sortOrder: data.sortState.field === 'modelName' ? data.sortState.order : null, width: 180 },
        { title: '默认模型', dataIndex: 'isDefault', sorter: true, sortOrder: data.sortState.field === 'isDefault' ? data.sortState.order : null, width: 110, renderText: value => value ? '是' : '否' },
        { title: '状态', dataIndex: 'enabled', sorter: true, sortOrder: data.sortState.field === 'enabled' ? data.sortState.order : null, width: 100, render: (_,row) => <StatusTag status={row.enabled ? 'enabled' : 'disabled'}/> },
        { title: '创建人', dataIndex: 'creatorName', sorter: true, sortOrder: data.sortState.field === 'creatorName' ? data.sortState.order : null, width: 100 },
        { title: '创建时间', dataIndex: 'createdAt', sorter: true, sortOrder: data.sortState.field === 'createdAt' ? data.sortState.order : null, width: 170 },
        { title: '操作', valueType: 'option', width: 220, fixed: 'right', render: (_,row) => <OperationColumnActions>
            <AdminTextAction onClick={() => nav.navigateWithReturn(`/model-connections/${row.id}/edit`)}>编辑</AdminTextAction>
            <AdminTextAction onClick={() => setTesting(row.id)}>测试连接</AdminTextAction>
            <StatusConfirmAction variant="text" action={row.enabled ? 'disable' : 'enable'} entityName="模型" targetName={row.name} description={row.isDefault ? '停用后取消默认模型，AI总结将暂不可用，直到重新设置启用的默认模型。' : undefined} onConfirm={async () => { await setModelConnectionStatus(row.id,row.enabled ? 0 : 1); refresh(); }}>{row.enabled ? '停用' : '启用'}</StatusConfirmAction>
            {row.enabled && !row.isDefault ? <ConfirmAction variant="text" title="设为默认模型？" description="AI总结将使用此模型，原默认模型保留但不再用于生成。" onConfirm={async () => { await setDefaultModelConnection(row.id); refresh(); }}>设为默认</ConfirmAction> : null}
        </OperationColumnActions> },
    ];
    return <><TemplateListPage<ModelConnection> title="模型中心" error={query.error?.message} onRetry={refresh}
        actions={<AdminButton type="primary" onClick={() => nav.navigateWithReturn('/model-connections/new')}>新增模型</AdminButton>}
        filter={<CompactFilterBar onSearch={filters.commitFilters} onReset={filters.resetFilters} items={[
            {key:'keyword',label:'名称 / 模型',node:<AdminInput value={filters.draftFilters.keyword} onChange={e => filters.setDraftFilters(value => ({...value,keyword:e.target.value}))} onPressEnter={filters.commitFilters}/>},
            {key:'enabled',label:'状态',node:<AdminSelect allowClear value={filters.draftFilters.enabled || undefined} options={[{value:'1',label:'启用'},{value:'0',label:'停用'}]} onChange={value => filters.setDraftFilters(old => ({...old,enabled:value || ''}))}/>},
        ]}/>}
        table={{rowKey:'id',columns,dataSource:data.pagedRows,loading:query.isFetching,search:false,pagination:false,tableAlertRender:false,preferenceKey:'model-center',scroll:{x:1360},onChange:data.handleTableChange}} pagination={data.pagination}/>
        <ModelTestDialog id={testing} onClose={() => setTesting('')}/></>;
}
