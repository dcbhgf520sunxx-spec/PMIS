import {useEffect,useState} from 'react';
import type {ProColumns} from '@ant-design/pro-components';
import {AdminButton,AdminInput,AdminSelect,AdminTextAction,CompactFilterBar,DetailLinkCell,OperationColumnActions,StatusConfirmAction,StatusTag,TemplateListPage,useCommittedFilters,usePageReturnNavigation,useTemplateListPageData} from '../../../components/admin';
import {listOpenClients,setOpenClientStatus,type OpenClient} from '../../../api/openClientApi';

export function OpenClientListPage() {
  const nav = usePageReturnNavigation('/integrations');
  const [rows,setRows] = useState<OpenClient[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  const filters = useCommittedFilters({keyword:'',enabled:''},{urlSync:true});
  useEffect(() => {
    let live = true;
    setLoading(true);setError('');
    listOpenClients().then((v) => {if (live) setRows(v);}).catch((e:Error) => {if (live) setError(e.message);}).finally(() => {if (live) setLoading(false);});
    return () => {live = false;};
  },[revision]);
  const data = useTemplateListPageData({rows:rows.filter((r) => `${r.name} ${r.code}`.includes(filters.appliedFilters.keyword.trim()) && (!filters.appliedFilters.enabled || String(r.enabled) === filters.appliedFilters.enabled)),urlSync:true});
  const columns:ProColumns<OpenClient>[] = [
    {title:'序号',width:60,fixed:'left',render:(_,__,i) => data.renderIndex(i)},
    {title:'系统名称',dataIndex:'name',width:240,fixed:'left',sorter:true,render:(_,r) => <DetailLinkCell onClick={() => nav.navigateWithReturn(`/integrations/clients/${r.id}`)}>{r.name}</DetailLinkCell>},
    {title:'状态',dataIndex:'enabled',width:100,sorter:true,render:(_,r) => <StatusTag status={r.enabled ? 'enabled' : 'disabled'} />},
    {title:'凭证有效期',dataIndex:'expiresAt',width:180,sorter:true,renderText:(v) => v ? String(v).slice(0,19).replace('T',' ') : '长期有效'},
    {title:'创建人',dataIndex:'creatorName',width:120,sorter:true},
    {title:'创建时间',dataIndex:'createdAt',width:180,sorter:true},
    {title:'操作',valueType:'option',width:240,fixed:'right',render:(_,r) => <OperationColumnActions>
      <AdminTextAction onClick={() => nav.navigateWithReturn(`/integrations/clients/${r.id}/edit`)}>编辑</AdminTextAction>
      <StatusConfirmAction variant="text" action={r.enabled ? 'disable' : 'enable'} entityName="接入系统" targetName={r.name} onConfirm={async () => {await setOpenClientStatus(r.id,r.enabled ? 0 : 1);setRevision((v) => v+1);}}>{r.enabled ? '停用' : '启用'}</StatusConfirmAction>
      <AdminTextAction onClick={() => nav.navigateWithReturn(`/integrations/clients/${r.id}/requests`)}>调用历史</AdminTextAction>
    </OperationColumnActions>},
  ];
  return <TemplateListPage<OpenClient> title="接口管理" error={error} onRetry={() => setRevision((v) => v+1)}
    actions={<><AdminButton onClick={() => nav.navigateWithReturn('/integrations/legacy')}>旧同步管理</AdminButton><AdminButton type="primary" onClick={() => nav.navigateWithReturn('/integrations/clients/new')}>新增接入系统</AdminButton></>}
    filter={<CompactFilterBar onSearch={filters.commitFilters} onReset={filters.resetFilters} items={[
      {key:'keyword',label:'系统名称',node:<AdminInput value={filters.draftFilters.keyword} onChange={(e) => filters.setDraftFilters((v) => ({...v,keyword:e.target.value}))} onPressEnter={filters.commitFilters} />},
      {key:'enabled',label:'状态',node:<AdminSelect allowClear value={filters.draftFilters.enabled || undefined} options={[{value:'1',label:'启用'},{value:'0',label:'停用'}]} onChange={(v) => filters.setDraftFilters((prev) => ({...prev,enabled:v || ''}))} />},
    ]} />}
    table={{rowKey:'id',columns,dataSource:data.pagedRows,loading,search:false,pagination:false,tableAlertRender:false,preferenceKey:'integration:open-clients:name-first',scroll:{x:1120},onChange:data.handleTableChange}} pagination={data.pagination} />;
}
