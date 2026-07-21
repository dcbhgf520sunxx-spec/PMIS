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
  TemplateFormPage,
  TemplateFormSection,
  type AdminProFormEditableListField,
  usePageReturnNavigation,
} from '../../../components/admin';
import { getProject, getProjectContract, saveProjectContract } from '../../../api/projectApi';
import { getArchiveOptionsByTypeName } from '../../../api/archiveApi';
import type { ProjectContractFormValues } from '../types';

const amountPattern = /^\d+(?:\.\d{1,2})?$/;
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

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    setError('');
    Promise.all([getProject(params.id), getProjectContract(params.id), getArchiveOptionsByTypeName('供应商')])
      .then(([, contract, options]) => {
        setSupplierOptions(options);
        setExists(Boolean(contract));
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
    </TemplateFormPage>
  );
}
