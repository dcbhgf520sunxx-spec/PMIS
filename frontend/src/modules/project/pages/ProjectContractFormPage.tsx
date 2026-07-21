import { useEffect, useState } from 'react';
import { CloudUploadOutlined } from '@ant-design/icons';
import { App, Upload, type UploadFile } from 'antd';
import { ProForm } from '@ant-design/pro-components';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  AdminProFormDatePicker,
  AdminProFormEditableList,
  AdminProFormMoney,
  AdminProFormSelect,
  AdminProFormText,
  AdminButton,
  AdminText,
  AdminUpload,
  TemplateFormPage,
  TemplateFormSection,
  type AdminProFormEditableListField,
  usePageReturnNavigation,
} from '../../../components/admin';
import {
  deleteProjectContractAttachment,
  downloadProjectContractAttachment,
  getProject,
  getProjectContract,
  saveProjectContract,
  uploadProjectContractAttachment,
} from '../../../api/projectApi';
import { getArchiveOptionsByTypeName } from '../../../api/archiveApi';
import type { ProjectContractFormValues } from '../types';

const amountPattern = /^\d+(?:\.\d{1,2})?$/;
const attachmentExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip'];
const attachmentAccept = attachmentExtensions.join(',');
const maxAttachmentSize = 20 * 1024 * 1024;

type ContractUploadResponse = { attachmentId?: string };
type ContractUploadFile = UploadFile<ContractUploadResponse>;

const attachmentIdOf = (file: ContractUploadFile) => file.response?.attachmentId;
const toUploadFile = (attachment: { id: string; originalName: string; fileSize: number; mimeType: string }): ContractUploadFile => ({
  uid: `attachment-${attachment.id}`,
  name: attachment.originalName,
  size: attachment.fileSize,
  type: attachment.mimeType,
  status: 'done',
  response: { attachmentId: attachment.id },
});

function validateAttachment(file: File) {
  const lowerName = file.name.toLowerCase();
  if (!attachmentExtensions.some((extension) => lowerName.endsWith(extension))) return '不支持该文件类型';
  if (file.size > maxAttachmentSize) return '单个附件不能超过20MB';
  return '';
}
const stageFields: AdminProFormEditableListField[] = [
  {
    key: 'stageName',
    title: '阶段名称',
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
    key: 'plannedAmount',
    title: '计划金额（元）',
    render: () => (
      <AdminProFormMoney
        name="plannedAmount"
        placeholder="请输入计划金额"
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
  const [attachmentFiles, setAttachmentFiles] = useState<ContractUploadFile[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    setError('');
    Promise.all([getProject(params.id), getProjectContract(params.id), getArchiveOptionsByTypeName('供应商')])
      .then(([, contract, options]) => {
        setSupplierOptions(options);
        setExists(Boolean(contract));
        setAttachmentFiles((contract?.attachments || []).map(toUploadFile));
        setRemovedAttachmentIds([]);
        setInitialValues(contract ? {
          contractCode: contract.contractCode,
          contractName: contract.contractName,
          supplierId: contract.supplierId,
          signedDate: contract.signedDate,
          contractAmount: contract.contractAmount.toFixed(2),
          stages: contract.stages.map((stage) => ({ id: stage.id, stageName: stage.stageName, plannedAmount: stage.plannedAmount.toFixed(2) })),
        } : { stages: [{ stageName: '', plannedAmount: '' }] });
      })
      .catch((loadError) => {
        const text = loadError instanceof Error ? loadError.message : '加载失败';
        if (text.includes('不存在')) setNotFound(true); else setError(text);
      })
      .finally(() => setLoading(false));
  }, [params.id, revision]);

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
        await saveProjectContract(params.id, values, exists);
        setExists(true);
        for (const attachmentId of removedAttachmentIds) {
          await deleteProjectContractAttachment(params.id, attachmentId);
          setRemovedAttachmentIds((current) => current.filter((id) => id !== attachmentId));
        }
        for (const file of attachmentFiles.filter((item) => item.originFileObj)) {
          const uploaded = await uploadProjectContractAttachment(params.id, file.originFileObj as File);
          setAttachmentFiles((current) => current.map((item) => item.uid === file.uid ? toUploadFile(uploaded) : item));
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
        </div>
      </TemplateFormSection>
      <TemplateFormSection title="付款阶段">
        <AdminProFormEditableList
          name="stages"
          fields={stageFields}
          creatorRecord={() => ({ stageName: '', plannedAmount: '' })}
        />
      </TemplateFormSection>
      <TemplateFormSection title="合同附件">
        <AdminUpload
          accept={attachmentAccept}
          multiple
          maxCount={10}
          fileList={attachmentFiles}
          beforeUpload={(file) => {
            const validationMessage = validateAttachment(file);
            if (validationMessage) {
              message.error(validationMessage);
              return Upload.LIST_IGNORE;
            }
            return false;
          }}
          onChange={({ fileList }) => setAttachmentFiles(fileList)}
          onRemove={(file) => {
            const attachmentId = attachmentIdOf(file);
            if (attachmentId) setRemovedAttachmentIds((current) => [...new Set([...current, attachmentId])]);
            return true;
          }}
          onDownload={(file) => {
            const attachmentId = attachmentIdOf(file);
            if (params.id && attachmentId) void downloadProjectContractAttachment(params.id, attachmentId, file.name);
          }}
          showUploadList={{ showDownloadIcon: (file) => Boolean(attachmentIdOf(file)) }}
        >
          <AdminButton icon={<CloudUploadOutlined />}>选择附件</AdminButton>
        </AdminUpload>
        <AdminText type="secondary">支持图片、PDF、Word、Excel 和 ZIP，单个文件不超过 20MB，最多 10 个。</AdminText>
      </TemplateFormSection>
    </TemplateFormPage>
  );
}
