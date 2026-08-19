import { useEffect, useState } from 'react';
import { App } from 'antd';
import { ProForm } from '@ant-design/pro-components';
import { useParams } from 'react-router-dom';
import type { AdminAttachment } from '../../../components/admin';
import { AdminAlert, AdminAttachmentUpload, AdminFormItem, AdminProFormDatePicker, AdminProFormMoney, AdminProFormSelect, AdminProFormText, AdminProFormTextArea, TemplateFormPage, TemplateFormSection, usePageReturnNavigation } from '../../../components/admin';
import { getArchiveOptionsByTypeName } from '../../../api/archiveApi';
import { createProductMaintenanceContract, deleteProductMaintenanceContractAttachment, downloadProductMaintenanceContractAttachment, getProductMaintenanceContract, getProductMaintenanceContracts, loadProductMaintenanceContractAttachmentPreview, updateProductMaintenanceContract, uploadProductMaintenanceContractAttachment } from '../../../api/productApi';
import type { ProductMaintenanceContractAttachment, ProductMaintenanceContractFormValues } from '../types';
import {
  COMMON_ATTACHMENT_ACCEPT,
  COMMON_ATTACHMENT_MAX_SIZE,
  COMMON_ATTACHMENT_TYPE_HINT,
} from '../../../components/business/businessAttachmentRules';

const pendingPrefix = 'pending-maintenance-contract-';
const amountPattern = /^\d+(\.\d{1,2})?$/;
const reminderText = '到期前30、15、7天提醒，最后3天每天提醒，并在到期当天提醒；到期后每7天提醒一次，直至完成续签或终止合同。';

function toAdminAttachment(attachment: ProductMaintenanceContractAttachment): AdminAttachment {
  return { id: attachment.id, name: attachment.originalName, size: attachment.fileSize, contentType: attachment.mimeType, status: 'done' };
}

function isPending(attachment: AdminAttachment) {
  return attachment.id.startsWith(pendingPrefix);
}

export function ProductMaintenanceContractFormPage() {
  const params = useParams();
  const fallback = params.id ? `/products/${params.id}` : '/products';
  const { returnToSource } = usePageReturnNavigation(fallback);
  const { message } = App.useApp();
  const [form] = ProForm.useForm<ProductMaintenanceContractFormValues>();
  const [hasExistingContract, setHasExistingContract] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [initialValues, setInitialValues] = useState<Partial<ProductMaintenanceContractFormValues>>();
  const [attachments, setAttachments] = useState<AdminAttachment[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
  const [attachmentError, setAttachmentError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [revision, setRevision] = useState(0);
  const editing = Boolean(params.contractId);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    setError('');
    Promise.all([
      getArchiveOptionsByTypeName('供应商'),
      getProductMaintenanceContracts(params.id),
      editing && params.contractId ? getProductMaintenanceContract(params.id, params.contractId) : Promise.resolve(null),
    ]).then(([options, contractList, contract]) => {
      setSupplierOptions(options);
      setHasExistingContract(contractList.length > 0);
      setAttachments((contract?.attachments || []).map(toAdminAttachment));
      setRemovedAttachmentIds([]);
      setAttachmentError('');
      setInitialValues(contract ? {
        contractCode: contract.contractCode,
        contractName: contract.contractName,
        supplierId: contract.supplierId,
        signedDate: contract.signedDate,
        serviceStartDate: contract.serviceStartDate,
        serviceEndDate: contract.serviceEndDate,
        contractAmount: contract.contractAmount.toFixed(2),
        remark: contract.remark,
      } : {});
    }).catch((loadError) => {
      const text = loadError instanceof Error ? loadError.message : '加载失败';
      if (text.includes('不存在')) setNotFound(true); else setError(text);
    }).finally(() => setLoading(false));
  }, [editing, params.contractId, params.id, revision]);

  return <TemplateFormPage<ProductMaintenanceContractFormValues>
    title={editing ? '编辑运维合同' : hasExistingContract ? '续签运维合同' : '新增运维合同'}
    formId="product-maintenance-contract-form"
    form={form}
    initialValues={initialValues}
    loading={loading}
    error={error}
    notFound={notFound}
    onRetry={() => setRevision((value) => value + 1)}
    onCancel={returnToSource}
    fieldNameMap={{ contract_code: 'contractCode', contract_name: 'contractName', supplier_id: 'supplierId', signed_date: 'signedDate', service_start_date: 'serviceStartDate', service_end_date: 'serviceEndDate', contract_amount: 'contractAmount' }}
    onSubmit={async (values) => {
      if (!params.id) return;
      if (attachments.length === 0) {
        setAttachmentError('请至少上传1个合同附件');
        throw new Error('请至少上传1个合同附件');
      }
      const pendingFiles = attachments
        .filter((item) => isPending(item) && item.rawFile)
        .map((item) => item.rawFile as File);
      if (params.contractId) {
        for (const file of pendingFiles) await uploadProductMaintenanceContractAttachment(params.id, params.contractId, file);
        await updateProductMaintenanceContract(params.id, params.contractId, values);
        for (const attachmentId of removedAttachmentIds) await deleteProductMaintenanceContractAttachment(params.id, params.contractId, attachmentId);
      } else {
        await createProductMaintenanceContract(params.id, values, pendingFiles);
      }
      message.success(editing ? '运维合同保存成功' : '运维合同创建成功');
      returnToSource();
    }}
  >
    <TemplateFormSection title="合同信息">
      <div className="admin-template-form-page__grid">
        <AdminProFormText name="contractCode" label="合同编号" disabled={editing} rules={[{ required: true, message: '请输入合同编号' }]} fieldProps={{ maxLength: 100 }} />
        <AdminProFormText name="contractName" label="合同名称" rules={[{ required: true, message: '请输入合同名称' }]} fieldProps={{ maxLength: 200 }} />
        <AdminProFormSelect name="supplierId" label="供应商" options={supplierOptions} rules={[{ required: true, message: '请选择供应商' }]} />
        <AdminProFormDatePicker name="signedDate" label="签订时间" rules={[{ required: true, message: '请选择签订时间' }]} />
        <AdminProFormDatePicker name="serviceStartDate" label="服务开始时间" rules={[{ required: true, message: '请选择服务开始时间' }]} />
        <AdminProFormDatePicker name="serviceEndDate" label="服务结束时间" rules={[{ required: true, message: '请选择服务结束时间' }]} />
        <AdminProFormMoney name="contractAmount" label="合同金额（元）" rules={[{ required: true, message: '请输入合同金额' }, { pattern: amountPattern, message: '请输入最多两位小数的金额' }, { validator: async (_rule: unknown, value: unknown) => { if (Number(value) <= 0) throw new Error('合同金额必须大于0'); } }]} />
        <AdminProFormTextArea name="remark" label="备注" className="admin-template-form-page__field is-full" fieldProps={{ rows: 3, maxLength: 1000 }} />
        <AdminFormItem label="合同附件" required validateStatus={attachmentError ? 'error' : undefined} help={attachmentError || undefined} className="admin-template-form-page__field is-full">
          <AdminAttachmentUpload
            accept={COMMON_ATTACHMENT_ACCEPT}
            multiple
            maxCount={10}
            maxSize={COMMON_ATTACHMENT_MAX_SIZE}
            value={attachments}
            onChange={(value) => { setAttachments(value); if (value.length > 0) setAttachmentError(''); }}
            onUpload={async (file, { onProgress }) => { onProgress(100); return { id: `${pendingPrefix}${file.uid}`, name: file.name, size: file.size, contentType: file.type }; }}
            onRemove={async (attachment) => { if (!isPending(attachment)) setRemovedAttachmentIds((current) => [...current, attachment.id]); }}
            onLoadPreview={async (attachment) => {
              if (attachment.rawFile) return attachment.rawFile;
              if (!params.id || !params.contractId) throw new Error('请先保存合同后再预览附件');
              return loadProductMaintenanceContractAttachmentPreview(params.id, params.contractId, attachment.id);
            }}
            onDownload={async (attachment) => {
              if (attachment.rawFile) {
                const url = URL.createObjectURL(attachment.rawFile); const link = document.createElement('a'); link.href = url; link.download = attachment.name; link.click(); URL.revokeObjectURL(url); return;
              }
              if (params.id && params.contractId) await downloadProductMaintenanceContractAttachment(params.id, params.contractId, attachment.id, attachment.name);
            }}
            hint={`${COMMON_ATTACHMENT_TYPE_HINT}；单个文件不超过20MB，最多10个。`}
          />
        </AdminFormItem>
      </div>
      <AdminAlert type="info" showIcon message="提醒规则" description={reminderText} />
    </TemplateFormSection>
  </TemplateFormPage>;
}
