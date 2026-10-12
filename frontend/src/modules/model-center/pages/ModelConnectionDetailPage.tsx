import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { AdminButton, ConfirmAction, DetailMetaList, StatusConfirmAction, StatusTag, TemplateDetailPage, TemplateDetailSection, usePageReturnNavigation } from '../../../components/admin';
import { getModelConnection, setDefaultModelConnection, setModelConnectionStatus } from '../../../api/modelConnectionApi';
import { ModelTestDialog } from '../components/ModelTestDialog';
export function ModelConnectionDetailPage() {
    const {id = ''} = useParams();
    const nav = usePageReturnNavigation('/model-connections');
    const cache = useQueryClient();
    const [testing,setTesting] = useState('');
    const query = useQuery({queryKey:['model-connection',id],queryFn:() => getModelConnection(id),refetchOnWindowFocus:false});
    const row = query.data;
    const refresh = () => { void query.refetch(); void cache.invalidateQueries({queryKey:['digital-twin','ai-summary']}); };
    return <><TemplateDetailPage title={row?.name || '模型详情'} loading={query.isPending} error={query.error?.message} onRetry={refresh} onBack={nav.returnToSource}
        actions={row ? <><AdminButton onClick={() => setTesting(id)}>测试连接</AdminButton>{row.enabled && !row.isDefault ? <ConfirmAction title="设为默认模型？" description="AI总结将使用此模型，原默认模型保留但不再用于生成。" onConfirm={async () => {await setDefaultModelConnection(id);refresh();}}>设为默认</ConfirmAction> : null}<AdminButton type="primary" onClick={() => nav.navigateWithReturn(`/model-connections/${id}/edit`)}>编辑</AdminButton></> : null}
        statusSection={row ? {items:[{label:'状态',value:<StatusTag status={row.enabled ? 'enabled' : 'disabled'}/>}]} : null}
        statusAction={row ? <StatusConfirmAction block type="primary" entityName="模型" targetName={row.name} action={row.enabled ? 'disable' : 'enable'} description={row.isDefault ? '停用后取消默认模型，AI总结将暂不可用，直到重新设置启用的默认模型。' : undefined} onConfirm={async () => {await setModelConnectionStatus(id,row.enabled ? 0 : 1);refresh();}}>{row.enabled ? '停用' : '启用'}</StatusConfirmAction> : null}
        documentSection={row ? {items:[{label:'创建人',value:row.creatorName},{label:'创建时间',value:row.createdAt},{label:'更新人',value:row.updaterName},{label:'更新时间',value:row.updatedAt}]} : null}>
        {row ? <TemplateDetailSection title="模型配置"><DetailMetaList items={[{label:'供应商',value:row.provider},{label:'服务地址',value:row.baseUrl},{label:'模型标识',value:row.modelName},{label:'默认模型',value:row.isDefault ? '是' : '否'},{label:'API密钥',value:row.keyConfigured ? '已配置（不回显）' : '未配置'},{label:'请求超时',value:`${row.timeoutSeconds}秒`} ]}/></TemplateDetailSection> : null}
    </TemplateDetailPage><ModelTestDialog id={testing} onClose={() => setTesting('')}/></>;
}
