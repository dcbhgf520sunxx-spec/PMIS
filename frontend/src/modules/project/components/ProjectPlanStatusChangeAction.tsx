import { useState } from 'react';
import { Tooltip } from 'antd';
import { AdminAttachmentUpload, AdminDatePicker, AdminFormItem, AdminTextArea, StatusChangeAction, StatusTag, type AdminAttachment, type StatusChangeActionProps } from '../../../components/admin';
import { deleteProjectPlanFile, downloadProjectPlanFile, loadProjectPlanFilePreview, uploadProjectPlanFile } from '../../../api/projectApi';
import type { ProjectPlanItem, ProjectPlanItemStatus } from '../types';

const labels:Record<ProjectPlanItemStatus,string>={0:'未开始',1:'进行中',2:'已完成',3:'暂停'};
const options:Record<ProjectPlanItemStatus,Array<{label:string;value:ProjectPlanItemStatus;tone:'normal'|'success'|'danger'}>>={
  0:[{label:'进行中',value:1,tone:'normal'},{label:'暂停',value:3,tone:'danger'}],
  1:[{label:'已完成',value:2,tone:'success'},{label:'暂停',value:3,tone:'danger'}],
  2:[{label:'进行中',value:1,tone:'normal'}],
  3:[{label:'未开始',value:0,tone:'normal'},{label:'进行中',value:1,tone:'normal'}],
};

export function renderProjectPlanItemStatus(status:ProjectPlanItemStatus,pauseReason?:string){
  const tag=<StatusTag status={status===2?'success':status===1?'processing':status===3?'error':'pending'} text={labels[status]} />;
  return status===3&&pauseReason?<Tooltip title={pauseReason}><span>{tag}</span></Tooltip>:tag;
}

type Props=Omit<StatusChangeActionProps<ProjectPlanItemStatus>,'current'|'currentValue'|'options'|'renderExtra'>&{projectId:string;item:ProjectPlanItem};
export function ProjectPlanStatusChangeAction({projectId,item,...props}:Props){
  const [completionFiles,setCompletionFiles]=useState<AdminAttachment[]>([]);
  const allowed=options[item.status].filter((option)=>item.status!==3||option.value===item.previousStatus);
  return <StatusChangeAction<ProjectPlanItemStatus>
    {...props}
    current={item.status}
    currentValue={renderProjectPlanItemStatus(item.status)}
    options={allowed}
    renderExtra={(target)=><>
      {target===2?<AdminFormItem name="actualEndDate" label="实际完成时间" rules={[{required:true,message:'请选择实际完成时间'}]}><AdminDatePicker /></AdminFormItem>:null}
      {target===3?<AdminFormItem name="pauseReason" label="暂停原因" rules={[{required:true,whitespace:true,message:'请填写暂停原因'},{max:200,message:'暂停原因不能超过200个字符'}]}><AdminTextArea rows={3} maxLength={200} showCount placeholder="请输入暂停原因"/></AdminFormItem>:null}
      {target===2&&item.requiresDeliveryFile&&item.fileCount===0?<AdminFormItem label="关键交付文件" required>
        <AdminAttachmentUpload value={completionFiles} onChange={setCompletionFiles}
          multiple
          onUpload={async(file)=>{const saved=await uploadProjectPlanFile(projectId,item.id,file);return {id:saved.id,name:saved.name,size:saved.size,contentType:saved.contentType};}}
          onRemove={async(attachment)=>{await deleteProjectPlanFile(projectId,item.id,attachment.id);}}
          onLoadPreview={(attachment)=>loadProjectPlanFilePreview(projectId,item.id,attachment.id)}
          onDownload={(attachment)=>downloadProjectPlanFile(projectId,item.id,attachment.id,attachment.name)}
          hint={item.deliveryRequirement||'请上传关键交付文件后再确认完成'}/>
      </AdminFormItem>:null}
    </>}
  />;
}
