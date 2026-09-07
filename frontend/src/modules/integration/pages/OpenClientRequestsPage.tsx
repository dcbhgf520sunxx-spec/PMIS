import {useParams} from 'react-router-dom';
import {useState} from 'react';
import type {ProColumns} from '@ant-design/pro-components';
import {AdminButton,AdminInput,AdminModal,AdminSelect,AdminTextAction,CompactFilterBar,DetailMetaList,OperationColumnActions,StatusTag,TemplateListPage,useCommittedFilters,usePageReturnNavigation,useTemplateServerListData} from '../../../components/admin';
import {getOpenClientRequests,type ClientRequest} from '../../../api/openClientApi';

const operations:Record<string,string> = {QUERY:'查询',CREATE:'新增',UPDATE:'编辑',DELETE:'删除',CHANGE_STATUS:'变更状态',CHANGE_PRIORITY:'调整优先级',HEALTH:'测试连接',REFERENCE_DATA:'基础数据',ATTACHMENT_LIST:'附件列表',ATTACHMENT_UPLOAD:'上传附件',ATTACHMENT_DOWNLOAD:'下载附件',ATTACHMENT_DELETE:'删除附件'};
const resourceNames:Record<string,string> = {requirement:'需求',work_order:'运维工单',system:'系统'};
export function OpenClientRequestsPage() {
  const {id = ''} = useParams();
  const nav = usePageReturnNavigation('/integrations');
  const [selected,setSelected] = useState<ClientRequest>();
  const filters = useCommittedFilters({sourceRecordId:'',outcome:''},{urlSync:true});
  const data = useTemplateServerListData({queryKey:['open-client-requests',id,filters.appliedFilters,filters.revision],urlSync:true,request:({current,pageSize,sortField,sortOrder}) => getOpenClientRequests(id,{...filters.appliedFilters,page:current,pageSize,sortField,sortOrder})});
  const columns:ProColumns<ClientRequest>[] = [
    {title:'调用时间',dataIndex:'createdAt',width:180,fixed:'left',sorter:true},
    {title:'业务类型',dataIndex:'resourceType',width:110,sorter:true,renderText:(v) => resourceNames[v] || v},
    {title:'操作',dataIndex:'operation',width:130,sorter:true,renderText:(v) => operations[v] || v},
    {title:'操作人',dataIndex:'operatorName',width:120,sorter:true},
    {title:'来源编号',dataIndex:'sourceRecordId',width:180,sorter:true},
    {title:'结果',dataIndex:'outcome',width:130,sorter:true,render:(_,r) => <StatusTag status={r.outcome === 'failed' ? 'error' : 'success'} text={r.outcome === 'failed' ? '失败' : r.outcome === 'replayed' ? '重复请求' : '成功'} />},
    {title:'处理说明',dataIndex:'message',width:260,sorter:true},
    {title:'操作',valueType:'option',width:100,fixed:'right',render:(_,r) => <OperationColumnActions><AdminTextAction onClick={() => setSelected(r)}>查看明细</AdminTextAction></OperationColumnActions>},
  ];
  const sortedColumns = columns.map((c) => c.sorter ? {...c,sortOrder:data.sortState.field === c.dataIndex ? data.sortState.order : null} : c);
  return <><TemplateListPage<ClientRequest> title="调用历史" actions={<AdminButton onClick={nav.returnToSource}>返回</AdminButton>} error={data.error} onRetry={data.reload}
    filter={<CompactFilterBar onSearch={filters.commitFilters} onReset={filters.resetFilters} items={[
      {key:'sourceRecordId',label:'来源编号',node:<AdminInput value={filters.draftFilters.sourceRecordId} onChange={(e) => filters.setDraftFilters((v) => ({...v,sourceRecordId:e.target.value}))} onPressEnter={filters.commitFilters} />},
      {key:'outcome',label:'调用结果',node:<AdminSelect allowClear value={filters.draftFilters.outcome || undefined} options={[{value:'success',label:'成功'},{value:'failed',label:'失败'},{value:'replayed',label:'重复请求'}]} onChange={(v) => filters.setDraftFilters((prev) => ({...prev,outcome:v || ''}))} />},
    ]} />}
    table={{rowKey:'id',columns:sortedColumns,dataSource:data.pagedRows,loading:data.loading,pagination:false,search:false,tableAlertRender:false,scroll:{x:1250},preferenceKey:'integration:open-requests',onChange:data.handleTableChange}} pagination={data.pagination} />
    <AdminModal title="调用明细" open={Boolean(selected)} onCancel={() => setSelected(undefined)} onOk={() => setSelected(undefined)} okText="关闭" cancelButtonProps={{style:{display:'none'}}}>
      {selected ? <DetailMetaList items={[
        {label:'请求追踪号',value:selected.requestId,wide:true},{label:'来源编号',value:selected.sourceRecordId,wide:true},{label:'调用时间',value:selected.createdAt},{label:'操作人',value:selected.operatorName},
        {label:'业务类型',value:resourceNames[selected.resourceType]},{label:'执行动作',value:operations[selected.operation]},{label:'响应状态码',value:selected.httpStatus},
        {label:'处理说明',value:selected.message,wide:true,longText:true},{label:'字段校验说明',value:selected.fieldErrors ? Object.values(selected.fieldErrors).flat().join('\n') : null,wide:true,longText:true},
      ]} /> : null}
    </AdminModal></>;
}
