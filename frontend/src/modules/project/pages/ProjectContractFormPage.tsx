import { useEffect, useState } from 'react';
import { App } from 'antd';
import { ProForm } from '@ant-design/pro-components';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  AdminProFormDatePicker,
  AdminProFormEditableList,
  AdminProFormMoney,
  AdminProFormSelect,
  AdminProFormText,
  AdminProFormTextArea,
  AdminAttachmentUpload,
  AdminFormItem,
  AdminNumberInput,
  TemplateFormPage,
  TemplateFormSection,
  type AdminAttachment,
  type AdminProFormEditableListField,
  usePageReturnNavigation,
} from '../../../components/admin';
import {
  deleteProjectContractAttachment,
  downloadProjectContractAttachment,
  getProject,
  getProjectContract,
  loadProjectContractAttachmentPreview,
  saveProjectContract,
  uploadProjectContractAttachment,
} from '../../../api/projectApi';
import { getArchiveOptionsByTypeName } from '../../../api/archiveApi';
import type { ProjectContractFormValues } from '../types';
import {
  calculateStagePlannedAmounts,
  deriveStagePaymentRatios,
  isPaymentRatioTotalValid,
} from '../projectContractCalculations';

const amountPattern = /^\d+(?:\.\d{1,2})?$/;
const attachmentExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip'];
const attachmentAccept = attachmentExtensions.join(',');
const maxAttachmentSize = 20 * 1024 * 1024;

const pendingAttachmentPrefix = 'pending-';
const isPendingAttachment = (attachment: AdminAttachment) => attachment.id.startsWith(pendingAttachmentPrefix);
const toAdminAttachment = (attachment: { id: string; originalName: string; fileSize: number; mimeType: string }): AdminAttachment => ({
  id: attachment.id,
  name: attachment.originalName,
  size: attachment.fileSize,
  contentType: attachment.mimeType,
  status: 'done',
});

function downloadLocalAttachment(attachment: AdminAttachment) {
  if (!attachment.rawFile) return;
  const url = URL.createObjectURL(attachment.rawFile);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.name;
  link.click();
  URL.revokeObjectURL(url);
}
const stageFields: AdminProFormEditableListField[] = [
  {
    key: 'stageName',
    title: '阶段名称',
    width: 'wide',
    render: () => (
      <AdminProFormText
        name="stageName"
        placeholder="请输入阶段名称"
        rules={[{ required: true, message: '请输入阶段名称' }]}
        fieldProps={{ maxLength: 100 }}
      />
    ),
  },
  {
    key: 'paymentRatio',
    title: '付款比例',
    width: 'compact',
    render: ({ field }) => (
      <AdminFormItem
        name={[field.name, 'paymentRatio']}
        rules={[
          { required: true, message: '请输入付款比例' },
          { validator: async (_: unknown, value: unknown) => {
            const ratio = Number(value);
            if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 100) throw new Error('付款比例必须大于0且不超过100%');
          } },
        ]}
      >
        <AdminNumberInput
          min={0.01}
          max={100}
          precision={2}
          step={0.01}
          stringMode
          controls={false}
          suffix="%"
          placeholder="请输入比例"
        />
      </AdminFormItem>
    ),
  },
  {
    key: 'plannedAmount',
    title: '计划金额（元）',
    width: 'compact',
    render: () => (
      <AdminProFormMoney
        name="plannedAmount"
        placeholder="自动计算"
        disabled
        rules={[
          { required: true, message: '请输入计划金额' },
          { pattern: amountPattern, message: '请输入最多两位小数的金额' },
          { validator: async (_: unknown, value: unknown) => { if (Number(value) <= 0) throw new Error('计划金额必须大于0'); } },
        ]}
        fieldProps={{ inputMode: 'decimal' }}
      />
    ),
  },
];

export function ProjectContractFormPage() {
  const params = useParams();
  const fallback = params.id ? `/projects/${params.id}` : '/projects';
  const { returnToSource } = usePageReturnNavigation(fallback);
  const { message } = App.useApp();
  const [form] = ProForm.useForm<ProjectContractFormValues>();
  const [supplierOptions, setSupplierOptions] = useState<Array<{ label: string; value: string; code: string }>>([]);
  const [exists, setExists] = useState(false);
  const [initialValues, setInitialValues] = useState<Partial<ProjectContractFormValues>>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [revision, setRevision] = useState(0);
  const [attachmentFiles, setAttachmentFiles] = useState<AdminAttachment[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
  const watchedContractAmount = ProForm.useWatch('contractAmount', form);
  const watchedStages = ProForm.useWatch('stages', form);
  const paymentRatioSignature = (watchedStages || []).map((stage) => stage?.paymentRatio || '').join('|');

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    setError('');
    Promise.all([getProject(params.id), getProjectContract(params.id), getArchiveOptionsByTypeName('供应商')])
      .then(([, contract, options]) => {
        setSupplierOptions(options);
        setExists(Boolean(contract));
        setAttachmentFiles((contract?.attachments || []).map(toAdminAttachment));
        setRemovedAttachmentIds([]);
        const paymentRatios = contract
          ? deriveStagePaymentRatios(contract.contractAmount, contract.stages.map((stage) => stage.plannedAmount))
          : [];
        setInitialValues(contract ? {
          contractCode: contract.contractCode,
          contractName: contract.contractName,
          supplierId: contract.supplierId,
          signedDate: contract.signedDate,
          contractAmount: contract.contractAmount.toFixed(2),
          remark: contract.remark,
          stages: contract.stages.map((stage, index) => ({
            id: stage.id,
            stageName: stage.stageName,
            paymentRatio: paymentRatios[index],
            plannedAmount: stage.plannedAmount.toFixed(2),
          })),
        } : { stages: [{ stageName: '', paymentRatio: '', plannedAmount: '' }] });
      })
      .catch((loadError) => {
        const text = loadError instanceof Error ? loadError.message : '加载失败';
        if (text.includes('不存在')) setNotFound(true); else setError(text);
      })
      .finally(() => setLoading(false));
  }, [params.id, revision]);

  useEffect(() => {
    const stages = (form.getFieldValue('stages') || []) as ProjectContractFormValues['stages'];
    const plannedAmounts = calculateStagePlannedAmounts(
      watchedContractAmount,
      stages.map((stage) => stage?.paymentRatio)
    );
    if (!plannedAmounts.some(Boolean)) return;
    if (stages.every((stage, index) => stage?.plannedAmount === plannedAmounts[index])) return;
    form.setFieldValue('stages', stages.map((stage, index) => ({
      ...stage,
      plannedAmount: plannedAmounts[index],
    })));
  }, [form, watchedContractAmount, paymentRatioSignature]);

  return (
    <TemplateFormPage<ProjectContractFormValues>
      title={exists ? '编辑项目合同' : '新增项目合同'}
      formId="project-contract-form"
      form={form}
      initialValues={initialValues}
      loading={loading}
      error={error}
      notFound={notFound}
      onRetry={() => setRevision((value) => value + 1)}
      onCancel={returnToSource}
      fieldNameMap={{ contract_code: 'contractCode', contract_name: 'contractName', supplier_id: 'supplierId', signed_date: 'signedDate', contract_amount: 'contractAmount', stages: 'stages' }}
      onSubmit={async (values) => {
        if (!params.id) return;
        const saveResult = await saveProjectContract(params.id, values, exists);
        setExists(true);
        for (const attachmentId of removedAttachmentIds) {
          await deleteProjectContractAttachment(params.id, attachmentId, saveResult.operationId);
          setRemovedAttachmentIds((current) => current.filter((id) => id !== attachmentId));
        }
        for (const attachment of attachmentFiles.filter((item) => isPendingAttachment(item) && item.rawFile)) {
          const uploaded = await uploadProjectContractAttachment(params.id, attachment.rawFile as File, saveResult.operationId);
          setAttachmentFiles((current) => current.map((item) => item.id === attachment.id ? toAdminAttachment(uploaded) : item));
        }
        message.success(exists ? '合同保存成功' : '合同创建成功');
        returnToSource();
      }}
    >
      <TemplateFormSection title="合同信息">
        <div className="admin-template-form-page__grid">
          <AdminProFormText name="contractCode" label="合同编码" rules={[{ required: true, message: '请输入合同编码' }]} fieldProps={{ maxLength: 100 }} />
          <AdminProFormText name="contractName" label="合同名称" rules={[{ required: true, message: '请输入合同名称' }]} fieldProps={{ maxLength: 200 }} />
          <AdminProFormSelect name="supplierId" label="供应商" options={supplierOptions} rules={[{ required: true, message: '请选择供应商' }]} />
          <AdminProFormDatePicker name="signedDate" label="签订时间" rules={[{ required: true, message: '请选择签订时间' }]} fieldProps={{ maxDate: dayjs() }} />
          <AdminProFormMoney
            name="contractAmount"
            label="合同金额（元）"
            rules={[
              { required: true, message: '请输入合同金额' },
              { pattern: amountPattern, message: '请输入最多两位小数的金额' },
              { validator: async (_: unknown, value: unknown) => { if (Number(value) <= 0) throw new Error('合同金额必须大于0'); } },
            ]}
            fieldProps={{ inputMode: 'decimal' }}
          />
          <AdminProFormTextArea
            name="remark"
            label="备注"
            className="admin-template-form-page__field is-full"
            fieldProps={{ rows: 3, maxLength: 1000 }}
            placeholder="请输入备注"
          />
          <AdminFormItem label="合同附件" className="admin-template-form-page__field is-full">
            <AdminAttachmentUpload
              accept={attachmentAccept}
              multiple
              maxCount={10}
              maxSize={maxAttachmentSize}
              value={attachmentFiles}
              onChange={setAttachmentFiles}
              onUpload={async (file, { onProgress }) => {
                onProgress(100);
                return {
                  id: `${pendingAttachmentPrefix}${file.uid}`,
                  name: file.name,
                  size: file.size,
                  contentType: file.type,
                };
              }}
              onRemove={(attachment) => {
                if (!isPendingAttachment(attachment)) {
                  setRemovedAttachmentIds((current) => [...new Set([...current, attachment.id])]);
                }
              }}
              onLoadPreview={(attachment) => {
                if (isPendingAttachment(attachment)) {
                  if (attachment.rawFile) return attachment.rawFile;
                  return Promise.reject(new Error('附件内容不存在，无法预览'));
                } else if (params.id) {
                  return loadProjectContractAttachmentPreview(params.id, attachment.id);
                }
                return Promise.reject(new Error('缺少项目编号，无法加载预览'));
              }}
              onDownload={(attachment) => {
                if (isPendingAttachment(attachment)) {
                  downloadLocalAttachment(attachment);
                } else if (params.id) {
                  return downloadProjectContractAttachment(params.id, attachment.id, attachment.name);
                }
              }}
              hint="支持图片、PDF、Word、Excel 和 ZIP，单个文件不超过 20MB，最多 10 个；选择后随合同保存上传。"
            />
          </AdminFormItem>
        </div>
      </TemplateFormSection>
      <TemplateFormSection title="付款阶段">
        <AdminProFormEditableList
          name="stages"
          fields={stageFields}
          rules={[{
            validator: async (_: unknown, stages: ProjectContractFormValues['stages']) => {
              if (!isPaymentRatioTotalValid((stages || []).map((stage) => stage?.paymentRatio))) {
                throw new Error('付款比例合计必须等于100%');
              }
            },
          }]}
          creatorRecord={() => ({ stageName: '', paymentRatio: '', plannedAmount: '' })}
        />
      </TemplateFormSection>
    </TemplateFormPage>
  );
}
