import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AdminAlert, AdminAttachmentUpload, DeleteConfirmAction, DetailMetaList, PermissionButton, TemplateDetailPage, TemplateDetailSection, usePageReturnNavigation, type AdminAttachment } from '../../../components/admin';
import { deleteProductMaintenanceContract, downloadProductMaintenanceContractAttachment, getProductMaintenanceContract, loadProductMaintenanceContractAttachmentPreview, terminateProductMaintenanceContract } from '../../../api/productApi';
import { ProductMaintenanceContractStatusChangeAction } from '../components/ProductMaintenanceContractStatusChangeAction';
import { renderMaintenanceContractStatus } from '../maintenanceContractStatus';
import type { ProductMaintenanceContract } from '../types';

const reminderText = '到期前30、15、7天提醒，最后3天每天提醒，并在到期当天提醒；到期后每7天提醒一次，直至完成续签或终止合同。';
const money = (value: number) => value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ProductMaintenanceContractDetailPage() {
  const params = useParams();
  const fallback = params.id ? `/products/${params.id}` : '/products';
  const { navigateWithReturn, returnToSource } = usePageReturnNavigation(fallback);
  const [contract, setContract] = useState<ProductMaintenanceContract>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!params.id || !params.contractId) return;
    setLoading(true); setError('');
    getProductMaintenanceContract(params.id, params.contractId).then(setContract).catch((loadError) => {
      const text = loadError instanceof Error ? loadError.message : '加载失败';
      if (text.includes('不存在')) setNotFound(true); else setError(text);
    }).finally(() => setLoading(false));
  }, [params.contractId, params.id, revision]);
  const attachmentFiles: AdminAttachment[] = (contract?.attachments || []).map((attachment) => ({ id: attachment.id, name: attachment.originalName, size: attachment.fileSize, contentType: attachment.mimeType, status: 'done' }));
  return <TemplateDetailPage
    title="运维合同详情"
    loading={loading}
    error={error}
    notFound={notFound}
    onRetry={() => setRevision((value) => value + 1)}
    onBack={returnToSource}
    actions={contract ? <>
      <PermissionButton permission="product" type="primary" onClick={() => navigateWithReturn(`/products/${contract.productId}/maintenance-contracts/${contract.id}/edit`)}>编辑</PermissionButton>
      {!contract.hasSuccessor ? <DeleteConfirmAction entityName="运维合同" targetName={contract.contractName} successMessage="删除成功" onConfirm={async () => { await deleteProductMaintenanceContract(contract.productId, contract.id); returnToSource(); }}>删除</DeleteConfirmAction> : null}
    </> : null}
    statusSection={contract ? { items: [{ label: '状态', value: renderMaintenanceContractStatus(contract.status), wide: true }] } : null}
    statusAction={contract && !contract.hasSuccessor && contract.status !== 'terminated' ? <ProductMaintenanceContractStatusChangeAction contract={contract} block onTerminated={async (values) => { await terminateProductMaintenanceContract(contract.productId, contract.id, values); setRevision((value) => value + 1); }} /> : null}
    documentSection={contract ? { items: [{ label: '创建人', value: contract.creatorName }, { label: '创建时间', value: contract.createdAt, wide: true }, { label: '更新人', value: contract.updaterName }, { label: '更新时间', value: contract.updatedAt, wide: true }] } : null}
  >
    {contract ? <>
      <TemplateDetailSection title="合同信息"><DetailMetaList items={[
        { label: '所属产品', value: contract.productName },
        { label: '上一份合同', value: contract.previousContractName },
        { label: '合同编号', value: contract.contractCode },
        { label: '合同名称', value: contract.contractName },
        { label: '供应商', value: contract.supplierName },
        { label: '签订时间', value: contract.signedDate },
        { label: '服务开始时间', value: contract.serviceStartDate },
        { label: '服务结束时间', value: contract.serviceEndDate },
        { label: '合同金额（元）', value: money(contract.contractAmount) },
        { label: '终止时间', value: contract.terminationDate },
        { label: '终止原因', value: contract.terminationReason, wide: true, longText: true },
        { label: '备注', value: contract.remark, wide: true, longText: true },
        { label: '合同附件', value: <AdminAttachmentUpload readOnly value={attachmentFiles} onLoadPreview={(attachment) => loadProductMaintenanceContractAttachmentPreview(contract.productId, contract.id, attachment.id)} onDownload={(attachment) => downloadProductMaintenanceContractAttachment(contract.productId, contract.id, attachment.id, attachment.name)} />, wide: true },
      ]} /></TemplateDetailSection>
      <TemplateDetailSection title="提醒规则"><AdminAlert type="info" showIcon message="固定提醒规则" description={reminderText} /></TemplateDetailSection>
    </> : null}
  </TemplateDetailPage>;
}
