import { useEffect, useMemo, useState, type DragEvent } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { App, Form } from 'antd';
import { DeleteOutlined, HolderOutlined } from '@ant-design/icons';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ActionBar, AdminAttachmentUpload, AdminButton, AdminDatePicker, AdminDrawer, AdminEmptyState, AdminIconAction, AdminInput, AdminModal, AdminSelect,
  AdminFormItem, AdminSwitch, AdminTextAction, AdminTextArea, DeleteConfirmAction,
  ExpandToggleButton, HistoryTimelineSection, OperationColumnActions, PermissionButton, StatusTag, TemplateDetailPage,
  TemplateDetailTableSection, usePageReturnNavigation, type AdminAttachment, type HistoryTimelineItem,
} from '../../../components/admin';
import {
  adjustProjectPlanItem, changeProjectPlanItemStatus, createProjectPlanItems, createProjectPlanStage,
  deleteProjectPlanFile, deleteProjectPlanItem, deleteProjectPlanStage, downloadProjectPlanFile, getProjectPlanAdjustments,
  getProjectPlanFiles, getProjectStagePlan, getProjectStagePlanHistory, loadProjectPlanFilePreview, reorderProjectPlanItems,
  reorderProjectPlanStages, updateProjectPlanItem, updateProjectPlanStage, uploadProjectPlanFile,
} from '../../../api/projectApi';
import { getUserOptions } from '../../../api/userApi';
import type { ProjectPlanAdjustment, ProjectPlanDeliveryFile, ProjectPlanItem, ProjectPlanItemForm, ProjectPlanStage } from '../types';
import { ProjectPlanStatusChangeAction, renderProjectPlanItemStatus } from '../components/ProjectPlanStatusChangeAction';
import { getProjectPlanStagePresentation, resolveProjectPlanRowOrder } from '../projectPlanRowSort';
import './ProjectStagePlanPage.css';

type TableRow={key:string;kind:'stage'|'item';stage:ProjectPlanStage;item?:ProjectPlanItem};
type Option={label:string;value:string};
const emptyItem=(stageId:string):ProjectPlanItemForm=>({stageId,name:'',ownerId:'',collaboratorIds:[],requiresDeliveryFile:false});
const deliveryAttachment=(file:ProjectPlanDeliveryFile):AdminAttachment=>({id:file.id,name:file.name,size:file.size,contentType:file.contentType,status:'done'});
const mapHistoryItem=(item:Awaited<ReturnType<typeof getProjectStagePlanHistory>>[number]):HistoryTimelineItem=>({
  id:String(item.id),
  operator:item.operator,
  action:item.action,
  time:String(item.created_at).slice(0,19).replace('T',' '),
  changes:item.changes.map((change)=>({field:change.field_name||'-',before:change.old_value,after:change.new_value})),
});
const setProjectPlanDragPreview=(event:DragEvent<HTMLElement>)=>{
  const row=event.currentTarget.closest('tr');
  if(!row||!event.dataTransfer)return;
  const preview=row.cloneNode(true) as HTMLElement;
  const cells=Array.from(row.children) as HTMLElement[];
  const previewCells=Array.from(preview.children) as HTMLElement[];
  preview.className='project-plan-drag-preview';
  preview.style.width=`${row.getBoundingClientRect().width}px`;
  previewCells.forEach((cell,index)=>{const width=cells[index]?.getBoundingClientRect().width;if(width)cell.style.width=`${width}px`;});
  document.body.appendChild(preview);
  event.dataTransfer.effectAllowed='move';
  event.dataTransfer.setDragImage(preview,28,Math.min(24,row.getBoundingClientRect().height/2));
  window.setTimeout(()=>preview.remove());
};

export function ProjectStagePlanPage(){
  const params=useParams();
  const location=useLocation();
  const navigate=useNavigate();
  const {returnToSource}=usePageReturnNavigation('/projects');
  const {message}=App.useApp();
  const [stageForm]=Form.useForm<{name:string}>();
  const [plan,setPlan]=useState<Awaited<ReturnType<typeof getProjectStagePlan>>>();
  const [history,setHistory]=useState<HistoryTimelineItem[]>([]);
  const [users,setUsers]=useState<Option[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  const [collapsed,setCollapsed]=useState<Set<string>>(()=>new Set());
  const [createDrawer,setCreateDrawer]=useState<{stage:ProjectPlanStage;items:ProjectPlanItemForm[]}>();
  const [createAttempted,setCreateAttempted]=useState(false);
  const [createSubmitting,setCreateSubmitting]=useState(false);
  const [stageModal,setStageModal]=useState<{stage?:ProjectPlanStage}>();
  const [stageSubmitting,setStageSubmitting]=useState(false);
  const [itemModal,setItemModal]=useState<{item:ProjectPlanItem;values:ProjectPlanItemForm}>();
  const [itemAttempted,setItemAttempted]=useState(false);
  const [itemSubmitting,setItemSubmitting]=useState(false);
  const [adjustModal,setAdjustModal]=useState<{item:ProjectPlanItem;date:string;reason:string;attempted:boolean}>();
  const [historyModal,setHistoryModal]=useState<{item:ProjectPlanItem;rows:ProjectPlanAdjustment[]}>();
  const [fileModal,setFileModal]=useState<{item:ProjectPlanItem;files:ProjectPlanDeliveryFile[]}>();
  const [draggingRow,setDraggingRow]=useState<TableRow>();
  const [dragOverRow,setDragOverRow]=useState<TableRow>();

  const load=()=>{
    if(!params.id)return;
    setLoading(true);setError('');
    Promise.all([getProjectStagePlan(params.id),getUserOptions(),getProjectStagePlanHistory(params.id)]).then(([result,options,historyRows])=>{setPlan(result);setUsers(options);setHistory(historyRows.map(mapHistoryItem));}).catch((cause)=>setError(cause instanceof Error?cause.message:'加载失败')).finally(()=>setLoading(false));
  };
  useEffect(load,[params.id,revision]);
  const refresh=()=>setRevision((value)=>value+1);

  const visibleStages=useMemo(()=>plan?.stages||[],[plan]);

  const rows=useMemo<TableRow[]>(()=>visibleStages.flatMap((stage)=>[
    {key:`stage-${stage.id}`,kind:'stage' as const,stage},
    ...(collapsed.has(stage.id)?[]:stage.items.map((item)=>({key:`item-${item.id}`,kind:'item' as const,stage,item}))),
  ]),[visibleStages,collapsed]);

  const saveNewItems=async()=>{
    if(!params.id||!createDrawer)return;
    setCreateAttempted(true);
    const invalid=createDrawer.items.some((item)=>!item.name.trim()||!item.ownerId||!item.originalDueDate);
    if(invalid)return message.error('请完善必填信息');
    const names=createDrawer.items.map((item)=>item.name.trim());
    if(new Set(names).size!==names.length)return message.error('本次新增不能包含同名关键事项');
    setCreateSubmitting(true);
    try{
      await createProjectPlanItems(params.id,createDrawer.stage.id,createDrawer.items);
      message.success(`已新增 ${createDrawer.items.length} 条关键事项`);
      setCreateDrawer(undefined);setCreateAttempted(false);refresh();
    }finally{setCreateSubmitting(false);}
  };

  const updateCreateItem=(index:number,values:ProjectPlanItemForm)=>{
    setCreateDrawer((current)=>current?{...current,items:current.items.map((item,itemIndex)=>itemIndex===index?values:item)}:current);
  };

  const canDropRow=(target:TableRow)=>Boolean(
    draggingRow
    && draggingRow.key!==target.key
    && resolveProjectPlanRowOrder(visibleStages,draggingRow,target)
  );

  const dropPosition=(target:TableRow)=>{
    if(!draggingRow||!canDropRow(target))return '';
    const ids=draggingRow.kind==='stage'
      ? visibleStages.map((stage)=>stage.id)
      : draggingRow.stage.items.map((item)=>item.id);
    const activeId=draggingRow.kind==='stage'?draggingRow.stage.id:draggingRow.item!.id;
    const targetId=target.kind==='stage'?target.stage.id:target.item!.id;
    return ids.indexOf(activeId)<ids.indexOf(targetId)?'is-project-plan-drag-over-after':'is-project-plan-drag-over-before';
  };

  const handleDrop=async(target:TableRow)=>{
    const active=draggingRow;
    setDraggingRow(undefined);setDragOverRow(undefined);
    if(!params.id||!active||active.key===target.key)return;
    const order=resolveProjectPlanRowOrder(visibleStages,active,target);
    if(!order)return;
    const movedId=active.kind==='stage'?active.stage.id:active.item!.id;
    if(order.kind==='stage')await reorderProjectPlanStages(params.id,order.ids,movedId);
    else await reorderProjectPlanItems(params.id,order.stageId,order.ids,movedId);
    refresh();
  };

  const renderDragHandle=(row:TableRow)=><span
    className={`project-plan-drag-handle is-${row.kind}`}
    draggable
    aria-label={row.kind==='stage'?'拖动阶段调整顺序':'拖动关键事项调整顺序'}
    onDragStart={(event)=>{setProjectPlanDragPreview(event);setDraggingRow(row);setDragOverRow(undefined);}}
    onDragEnd={()=>{setDraggingRow(undefined);setDragOverRow(undefined);}}
  ><HolderOutlined/></span>;

  const columns:ProColumns<TableRow>[]=[
    {title:'阶段 / 关键事项',dataIndex:'name',width:340,fixed:'left',render:(_,row)=>{
      if(row.kind==='stage'){
        const presentation=getProjectPlanStagePresentation(row.stage);
        return <div className="project-plan-stage-name">{renderDragHandle(row)}<ExpandToggleButton variant="square" expanded={!collapsed.has(row.stage.id)} expandLabel={`展开 ${row.stage.name} 的关键事项`} collapseLabel={`收起 ${row.stage.name} 的关键事项`} onClick={()=>setCollapsed((current)=>{const next=new Set(current);if(next.has(row.stage.id))next.delete(row.stage.id);else next.add(row.stage.id);return next;})}/><span className="project-plan-stage-title">{row.stage.name}</span><span className="project-plan-stage-summary">{presentation.progressText}</span>{presentation.overdueText?<span className="project-plan-stage-overdue">{presentation.overdueText}</span>:null}</div>;
      }
      const item=row.item!;
      return <div className="project-plan-item-name">{renderDragHandle(row)}<div className="project-plan-item-copy"><span className="project-plan-item-title" title={item.name}>{item.name}</span>{item.requiresDeliveryFile?(item.status===2&&item.fileCount>0?<AdminTextAction onClick={()=>void openFiles(item)}>交付文件 {item.fileCount} ›</AdminTextAction>:<span className="project-plan-delivery-required">需交付文件</span>):null}</div></div>;
    }},
    {title:'负责人',dataIndex:'owner',width:190,render:(_,row)=>{
      if(row.kind==='stage')return null;
      const collaborators=row.item!.collaborators.map((person)=>person.name).join('、');
      return <div className="project-plan-owner"><span>{row.item!.ownerName}</span>{collaborators?<small title={`协作：${collaborators}`}>协作：{collaborators}</small>:null}</div>;
    }},
    {title:'状态',dataIndex:'status',width:150,render:(_,row)=>row.kind==='item'?<div className="project-plan-status">{renderProjectPlanItemStatus(row.item!.status,row.item!.pauseReason)}{row.item!.progressHint?<StatusTag status={row.item!.progressHint.startsWith('已逾期')||row.item!.progressHint==='延期完成'?'error':row.item!.progressHint==='按期完成'?'success':'processing'} text={row.item!.progressHint}/>:null}</div>:null},
    {title:'计划完成时间',dataIndex:'due',width:230,render:(_,row)=>row.kind==='stage'?getProjectPlanStagePresentation(row.stage).dueDate:<div className="project-plan-due"><span>{row.item!.currentDueDate}</span>{row.item!.adjustmentCount>0?<small>原计划 {row.item!.originalDueDate} · <AdminTextAction onClick={()=>void openHistory(row.item!)}>已调整 {row.item!.adjustmentCount} 次</AdminTextAction></small>:null}</div>},
    {title:'实际完成时间',dataIndex:'actual',width:140,render:(_,row)=>row.kind==='item'?row.item!.actualEndDate||'-':null},
    {title:'操作',valueType:'option',width:230,fixed:'right',render:(_,row)=>{
      if(row.kind==='stage')return <OperationColumnActions><AdminTextAction onClick={()=>{setCreateDrawer({stage:row.stage,items:[emptyItem(row.stage.id)]});setCreateAttempted(false);setCollapsed((current)=>{const next=new Set(current);next.delete(row.stage.id);return next;});}}>新增关键事项</AdminTextAction><AdminTextAction onClick={()=>{stageForm.setFieldsValue({name:row.stage.name});setStageModal({stage:row.stage});}}>编辑阶段</AdminTextAction><DeleteConfirmAction variant="text" entityName="阶段" targetName={row.stage.name} onConfirm={async()=>{await deleteProjectPlanStage(params.id!,row.stage.id);refresh();}}>删除</DeleteConfirmAction></OperationColumnActions>;
      const item=row.item!;
      return <OperationColumnActions><AdminTextAction onClick={()=>setItemModal({item,values:{stageId:item.stageId,name:item.name,ownerId:item.ownerId,collaboratorIds:item.collaborators.map((person)=>person.id),requiresDeliveryFile:item.requiresDeliveryFile,deliveryRequirement:item.deliveryRequirement,remark:item.remark}})}>编辑</AdminTextAction><ProjectPlanStatusChangeAction variant="text" projectId={params.id!} item={item} onConfirm={async(target,values)=>{await changeProjectPlanItemStatus(params.id!,item.id,target,{actual_end_date:(values.actualEndDate as any)?.format?.('YYYY-MM-DD'),pause_reason:values.pauseReason});message.success('状态更新成功');refresh();}}>状态变更</ProjectPlanStatusChangeAction><AdminTextAction onClick={()=>setAdjustModal({item,date:'',reason:'',attempted:false})}>调整计划</AdminTextAction><DeleteConfirmAction variant="text" entityName="关键事项" targetName={item.name} onConfirm={async()=>{await deleteProjectPlanItem(params.id!,item.id);refresh();}}>删除</DeleteConfirmAction></OperationColumnActions>;
    }},
  ];

  const openHistory=async(item:ProjectPlanItem)=>{if(!params.id)return;setHistoryModal({item,rows:await getProjectPlanAdjustments(params.id,item.id)});};
  const openFiles=async(item:ProjectPlanItem)=>{if(!params.id)return;setFileModal({item,files:await getProjectPlanFiles(params.id,item.id)});};
  return <>
    <TemplateDetailPage title="项目详情" loading={loading} error={error} onRetry={refresh} onBack={returnToSource}
      sectionNavigation={{items:[{key:'basic',title:'基本信息'},{key:'contract',title:'合同信息'},{key:'stage-plan',title:'阶段主计划'}],activeKey:'stage-plan',onChange:(key)=>{if(!params.id)return;if(key==='basic')navigate(`/projects/${params.id}${location.search}`);if(key==='contract')navigate(`/projects/${params.id}/contract-detail${location.search}`);}}}
      actions={<PermissionButton permission="project" type="primary" onClick={()=>{stageForm.setFieldsValue({name:''});setStageModal({});}}>新增阶段</PermissionButton>}>
      <TemplateDetailTableSection<TableRow> title="阶段主计划" sectionKey="stage-plan-table" summary={`共 ${visibleStages.length} 个阶段`} table={{rowKey:'key',columns,dataSource:rows,scroll:{x:1280},onRow:(row)=>({className:[`project-plan-row is-${row.kind}`,draggingRow?.key===row.key?'is-project-plan-dragging':'',dragOverRow?.key===row.key?dropPosition(row):''].filter(Boolean).join(' '),onDragEnter:()=>{if(canDropRow(row))setDragOverRow(row);},onDragOver:(event)=>{if(!canDropRow(row))return;event.preventDefault();event.dataTransfer.dropEffect='move';setDragOverRow(row);},onDragLeave:(event)=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setDragOverRow(undefined);},onDrop:(event)=>{if(!canDropRow(row))return;event.preventDefault();void handleDrop(row);}})}}/>
      <HistoryTimelineSection items={history} sectionKey="stage-plan-history"/>
    </TemplateDetailPage>
    <AdminDrawer
      title={`新增关键事项 · ${createDrawer?.stage.name||''}`}
      width="min(1200px, 100vw)"
      rootClassName="project-plan-create-drawer-root"
      open={Boolean(createDrawer)}
      destroyOnHidden
      maskClosable={!createSubmitting}
      closable={!createSubmitting}
      onClose={()=>{setCreateDrawer(undefined);setCreateAttempted(false);}}
      footer={<ActionBar><AdminButton disabled={createSubmitting} onClick={()=>{setCreateDrawer(undefined);setCreateAttempted(false);}}>取消</AdminButton><AdminButton type="primary" loading={createSubmitting} onClick={()=>void saveNewItems()}>确认新增{createDrawer?`（${createDrawer.items.length}）`:''}</AdminButton></ActionBar>}
    >
      {createDrawer?<Form layout="vertical" className="project-plan-create-form">
        <div className="project-plan-create-drawer">
          <p className="project-plan-create-tip">本次新增的关键事项全部归入“{createDrawer.stage.name}”，如需新增到其他阶段，请在对应阶段单独操作。</p>
          {createDrawer.items.map((item,index)=><ProjectPlanItemFields
            key={index}
            index={index}
            values={item}
            users={users}
            attempted={createAttempted}
            removable={createDrawer.items.length>1}
            showDueDate
            onChange={(values)=>updateCreateItem(index,values)}
            onRemove={()=>setCreateDrawer({...createDrawer,items:createDrawer.items.filter((_,itemIndex)=>itemIndex!==index)})}
          />)}
          <AdminButton block onClick={()=>setCreateDrawer({...createDrawer,items:[...createDrawer.items,emptyItem(createDrawer.stage.id)]})}>继续添加一条</AdminButton>
        </div>
      </Form>:null}
    </AdminDrawer>
    <AdminModal title={stageModal?.stage?'编辑阶段':'新增阶段'} open={Boolean(stageModal)} forceRender destroyOnHidden confirmLoading={stageSubmitting} onCancel={()=>{stageForm.resetFields();setStageModal(undefined);}} onOk={()=>stageForm.submit()}><Form form={stageForm} layout="vertical" preserve={false} onFinish={async(values)=>{if(!params.id||!stageModal)return;setStageSubmitting(true);try{const payload={name:values.name.trim()};if(stageModal.stage)await updateProjectPlanStage(params.id,stageModal.stage.id,payload);else await createProjectPlanStage(params.id,payload);stageForm.resetFields();setStageModal(undefined);refresh();}finally{setStageSubmitting(false);}}}><AdminFormItem name="name" label="阶段名称" rules={[{required:true,whitespace:true,message:'请输入阶段名称'}]}><AdminInput maxLength={100} placeholder="请输入阶段名称"/></AdminFormItem></Form></AdminModal>
    <AdminDrawer title="编辑关键事项" width="min(1200px, 100vw)" rootClassName="project-plan-create-drawer-root" open={Boolean(itemModal)} destroyOnHidden
      maskClosable={!itemSubmitting} closable={!itemSubmitting}
      onClose={()=>{setItemModal(undefined);setItemAttempted(false);}}
      footer={<ActionBar><AdminButton disabled={itemSubmitting} onClick={()=>{setItemModal(undefined);setItemAttempted(false);}}>取消</AdminButton><AdminButton type="primary" loading={itemSubmitting} onClick={async()=>{
        if(!params.id||!itemModal)return;
        setItemAttempted(true);
        if(!itemModal.values.stageId||!itemModal.values.name.trim()||!itemModal.values.ownerId)return;
        setItemSubmitting(true);
        try{
          await updateProjectPlanItem(params.id,itemModal.item.id,itemModal.values);
          setItemModal(undefined);setItemAttempted(false);refresh();
        }finally{setItemSubmitting(false);}
      }}>确认</AdminButton></ActionBar>}>
      {itemModal?<Form layout="vertical" className="project-plan-create-form">
        <div className="project-plan-create-drawer">
          <ProjectPlanItemFields
            index={0}
            values={itemModal.values}
            stages={plan?.stages||[]}
            users={users}
            attempted={itemAttempted}
            showStage
            onChange={(values)=>setItemModal({...itemModal,values})}
          />
        </div>
      </Form>:null}
    </AdminDrawer>
    <AdminModal title="调整计划完成时间" open={Boolean(adjustModal)} onCancel={()=>setAdjustModal(undefined)} onOk={async()=>{
      if(!params.id||!adjustModal)return;
      const reason=adjustModal.reason.trim();
      if(!adjustModal.date||!reason){setAdjustModal({...adjustModal,attempted:true});return;}
      await adjustProjectPlanItem(params.id,adjustModal.item.id,adjustModal.date,reason);
      setAdjustModal(undefined);refresh();
    }}>
      <Form layout="vertical">
        <AdminFormItem label="原计划完成时间"><AdminDatePicker value={adjustModal?.item.currentDueDate?dayjs(adjustModal.item.currentDueDate):undefined} disabled/></AdminFormItem>
        <AdminFormItem label="新的计划完成时间" required validateStatus={adjustModal?.attempted&&!adjustModal.date?'error':undefined} help={adjustModal?.attempted&&!adjustModal.date?'请选择新的计划完成时间':undefined}><AdminDatePicker value={adjustModal?.date?dayjs(adjustModal.date):undefined} onChange={(value:any)=>adjustModal&&setAdjustModal({...adjustModal,date:value?.format('YYYY-MM-DD')||''})}/></AdminFormItem>
        <AdminFormItem label="调整原因" required validateStatus={adjustModal?.attempted&&!adjustModal.reason.trim()?'error':undefined} help={adjustModal?.attempted&&!adjustModal.reason.trim()?'请输入调整原因':undefined}><AdminTextArea rows={3} maxLength={100} showCount value={adjustModal?.reason} placeholder="请输入调整原因" onChange={(event)=>adjustModal&&setAdjustModal({...adjustModal,reason:event.target.value.slice(0,100)})}/></AdminFormItem>
      </Form>
    </AdminModal>
    <AdminModal title={`计划调整记录 · ${historyModal?.item.name||''}`} open={Boolean(historyModal)} footer={null} onCancel={()=>setHistoryModal(undefined)}>
      {historyModal?.rows.length?<div className="project-plan-adjustment-list">{historyModal.rows.map((row,index)=><section className="project-plan-adjustment-card" key={row.id}>
        <header><strong>第 {historyModal.rows.length-index} 次调整</strong><span>{row.operatorName} · {row.createdAt}</span></header>
        <div className="project-plan-adjustment-card__summary">
          <div className="project-plan-adjustment-card__date"><span>原计划</span><strong>{row.oldDueDate}</strong></div>
          <span className="project-plan-adjustment-card__arrow">→</span>
          <div className="project-plan-adjustment-card__date"><span>调整后</span><strong>{row.newDueDate}</strong></div>
          <div className="project-plan-adjustment-card__reason"><span>调整原因</span><p title={row.reason}>{row.reason}</p></div>
        </div>
      </section>)}</div>:<AdminEmptyState description="暂无调整记录"/>}
    </AdminModal>
    <AdminModal title={`交付文件 · ${fileModal?.item.name||''}`} size="large" open={Boolean(fileModal)} footer={null} onCancel={()=>setFileModal(undefined)}>{fileModal&&params.id?<AdminAttachmentUpload multiple value={fileModal.files.map(deliveryAttachment)} onUpload={async(file)=>{const saved=await uploadProjectPlanFile(params.id!,fileModal.item.id,file);const files=await getProjectPlanFiles(params.id!,fileModal.item.id);setFileModal({...fileModal,files});refresh();return {id:saved.id,name:saved.name,size:saved.size,contentType:saved.contentType};}} onRemove={async(attachment)=>{await deleteProjectPlanFile(params.id!,fileModal.item.id,attachment.id);const files=await getProjectPlanFiles(params.id!,fileModal.item.id);setFileModal({...fileModal,files});refresh();}} onLoadPreview={(attachment)=>loadProjectPlanFilePreview(params.id!,fileModal.item.id,attachment.id)} onDownload={(attachment)=>downloadProjectPlanFile(params.id!,fileModal.item.id,attachment.id,attachment.name)} hint={fileModal.item.deliveryRequirement||'上传关键交付文件'}/>:null}</AdminModal>
  </>;
}

function ProjectPlanItemFields({index,values,stages=[],users,attempted,removable=false,showStage=false,showDueDate=false,onChange,onRemove}:{index:number;values:ProjectPlanItemForm;stages?:ProjectPlanStage[];users:Option[];attempted:boolean;removable?:boolean;showStage?:boolean;showDueDate?:boolean;onChange:(values:ProjectPlanItemForm)=>void;onRemove?:()=>void}){
  const stageError=attempted&&!values.stageId;
  const nameError=attempted&&!values.name.trim();
  const ownerError=attempted&&!values.ownerId;
  const dateError=attempted&&showDueDate&&!values.originalDueDate;
  return <section className="project-plan-create-item">
    <header><strong>{showStage?'关键事项':`关键事项 ${index+1}`}</strong>{removable&&onRemove?<AdminIconAction danger label="删除本条" icon={<DeleteOutlined/>} onClick={onRemove}/>:null}</header>
    <div className="project-plan-fields">
      {showStage?<AdminFormItem label="所属阶段" required validateStatus={stageError?'error':undefined} help={stageError?'请选择所属阶段':undefined}><AdminSelect value={values.stageId||undefined} placeholder="请选择所属阶段" options={stages.map((stage)=>({label:stage.name,value:stage.id}))} onChange={(value)=>onChange({...values,stageId:String(value)})}/></AdminFormItem>:null}
      <AdminFormItem label="关键事项名称" required validateStatus={nameError?'error':undefined} help={nameError?'请输入关键事项名称':undefined}><AdminInput value={values.name} maxLength={200} placeholder="请输入关键事项名称" onChange={(event)=>onChange({...values,name:event.target.value})}/></AdminFormItem>
      <AdminFormItem label="主负责人" required validateStatus={ownerError?'error':undefined} help={ownerError?'请选择主负责人':undefined}><AdminSelect value={values.ownerId||undefined} placeholder="请选择主负责人" options={users} onChange={(value)=>onChange({...values,ownerId:String(value),collaboratorIds:values.collaboratorIds.filter((id)=>id!==String(value))})}/></AdminFormItem>
      <AdminFormItem label="协作人"><AdminSelect mode="multiple" value={values.collaboratorIds} placeholder="请选择协作人" options={users.filter((user)=>user.value!==values.ownerId)} onChange={(value)=>onChange({...values,collaboratorIds:value.map(String)})}/></AdminFormItem>
      {showDueDate?<AdminFormItem label="计划完成时间" required validateStatus={dateError?'error':undefined} help={dateError?'请选择计划完成时间':undefined}><AdminDatePicker value={values.originalDueDate?dayjs(values.originalDueDate):undefined} onChange={(value:any)=>onChange({...values,originalDueDate:value?.format('YYYY-MM-DD')})}/></AdminFormItem>:null}
      <AdminFormItem className="is-switch" label="需要交付文件"><AdminSwitch checked={values.requiresDeliveryFile} onChange={(checked)=>onChange({...values,requiresDeliveryFile:checked,deliveryRequirement:''})}/></AdminFormItem>
      <AdminFormItem className="is-remark" label="备注"><AdminTextArea rows={1} value={values.remark} placeholder="请输入备注（非必填）" onChange={(event)=>onChange({...values,remark:event.target.value})}/></AdminFormItem>
    </div>
  </section>;
}
