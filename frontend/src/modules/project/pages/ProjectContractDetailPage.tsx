import { useEffect, useMemo, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AdminEmptyState,
  AdminTextAction,
  DetailMetaList,
  OperationColumnActions,
  PermissionButton,
  StatusTag,
  TemplateDetailPage,
  TemplateDetailSection,
  TemplateDetailTableSection,
  usePageReturnNavigation,
} from '../../../components/admin';
import { getProject, getProjectContract } from '../../../api/projectApi';
import { getUserOptions } from '../../../api/userApi';
import type { ProjectContractRecord, ProjectPaymentRecord, ProjectPaymentStage } from '../types';
import { ProjectPaymentModal } from '../components/ProjectPaymentModal';
import { ProjectPaymentDrawer } from '../components/ProjectPaymentDrawer';

const money = (value: number) => value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function renderPaymentStatus(status: ProjectPaymentStage['paymentStatus']) {
  if (status === 2) return <StatusTag status="success" text="已付清" />;
  if (status === 1) return <StatusTag status="processing" text="部分付款" />;
  return <StatusTag status="pending" text="未付款" />;
}

export function ProjectContractDetailPage() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { navigateWithReturn, returnToSource } = usePageReturnNavigation('/projects');
  const [projectName, setProjectName] = useState('');
  const [contract, setContract] = useState<ProjectContractRecord | null>(null);
  const [userOptions, setUserOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [revision, setRevision] = useState(0);
  const [paymentRevision, setPaymentRevision] = useState(0);
  const [paymentTarget, setPaymentTarget] = useState<{ stage: ProjectPaymentStage; payment?: ProjectPaymentRecord }>();
  const [drawerStage, setDrawerStage] = useState<ProjectPaymentStage>();

  const load = () => {
    if (!params.id) return;
    setLoading(true);
    setError('');
    Promise.all([
      getProject(params.id).then((project) => setProjectName(project.name)),
      getProjectContract(params.id).then(setContract),
      getUserOptions().then(setUserOptions),
    ]).catch((loadError) => {
      const text = loadError instanceof Error ? loadError.message : '加载失败';
      if (text.includes('不存在')) setNotFound(true); else setError(text);
    }).finally(() => setLoading(false));
  };

  useEffect(load, [params.id, revision]);

  const refreshContract = () => {
    setPaymentRevision((value) => value + 1);
    setRevision((value) => value + 1);
  };

  const stageColumns = useMemo<ProColumns<ProjectPaymentStage>[]>(() => [
    { title: '阶段', dataIndex: 'stageName', width: 180 },
    { title: '计划金额（元）', dataIndex: 'plannedAmount', width: 150, render: (_, stage) => money(stage.plannedAmount) },
    { title: '已付金额（元）', dataIndex: 'paidAmount', width: 150, render: (_, stage) => money(stage.paidAmount) },
    { title: '待付金额（元）', dataIndex: 'unpaidAmount', width: 150, render: (_, stage) => money(stage.unpaidAmount) },
    { title: '付款状态', dataIndex: 'paymentStatus', width: 130, render: (_, stage) => renderPaymentStatus(stage.paymentStatus) },
    {
      title: '操作', valueType: 'option', width: 180, fixed: 'right',
      render: (_, stage) => (
        <OperationColumnActions>
          {stage.paymentStatus !== 2 ? <AdminTextAction onClick={() => setPaymentTarget({ stage })}>登记付款</AdminTextAction> : null}
          <AdminTextAction onClick={() => setDrawerStage(stage)}>付款明细</AdminTextAction>
        </OperationColumnActions>
      ),
    },
  ], []);

  return (
    <>
      <TemplateDetailPage
        title="项目详情"
        titleCode={contract?.contractCode}
        loading={loading}
        error={error}
        notFound={notFound}
        onRetry={() => setRevision((value) => value + 1)}
        onBack={returnToSource}
        sectionNavigation={{
          items: [
            { key: 'basic', title: '基本信息' },
            { key: 'contract', title: '合同信息' },
          ],
          activeKey: 'contract',
          onChange: (key) => {
            if (key === 'basic' && params.id) navigate(`/projects/${params.id}${location.search}`);
          },
        }}
        actions={params.id ? (
          <PermissionButton permission="project" type="primary" onClick={() => navigateWithReturn(`/projects/${params.id}/contract`)}>
            {contract ? '编辑合同' : '新增合同'}
          </PermissionButton>
        ) : null}
      >
        <TemplateDetailSection title="合同信息" sectionKey="contract-basic">
          {contract ? <DetailMetaList items={[
            { label: '所属项目', value: contract.projectName || projectName }, { label: '合同编码', value: contract.contractCode },
            { label: '合同名称', value: contract.contractName }, { label: '供应商', value: contract.supplierName },
            { label: '签订时间', value: contract.signedDate }, { label: '合同金额（元）', value: money(contract.contractAmount) },
            { label: '已付金额（元）', value: money(contract.paidAmount) }, { label: '未付金额（元）', value: money(contract.unpaidAmount) },
          ]} /> : <AdminEmptyState description="暂未维护项目合同" />}
        </TemplateDetailSection>
        {contract ? (
          <TemplateDetailTableSection<ProjectPaymentStage>
            title="付款阶段"
            sectionKey="contract-payments"
            summary={`共 ${contract.stages.length} 个阶段`}
            table={{ columns: stageColumns, dataSource: contract.stages, scroll: { x: 940 } }}
          />
        ) : null}
      </TemplateDetailPage>
      {params.id ? (
        <>
          <ProjectPaymentModal
            open={Boolean(paymentTarget)}
            projectId={params.id}
            stage={paymentTarget?.stage}
            payment={paymentTarget?.payment}
            userOptions={userOptions}
            onClose={() => setPaymentTarget(undefined)}
            onSaved={refreshContract}
          />
          <ProjectPaymentDrawer
            open={Boolean(drawerStage)}
            projectId={params.id}
            stage={drawerStage}
            revision={paymentRevision}
            onClose={() => setDrawerStage(undefined)}
            onEdit={(payment) => drawerStage && setPaymentTarget({ stage: drawerStage, payment })}
            onChanged={refreshContract}
          />
        </>
      ) : null}
    </>
  );
}
