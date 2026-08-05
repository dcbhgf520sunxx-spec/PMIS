import { useEffect, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AdminTextAction, DeleteConfirmAction, DetailLinkCell, OperationColumnActions, PermissionButton, TemplateDetailPage, TemplateDetailTableSection, usePageReturnNavigation } from '../../../components/admin';
import { deleteProductMaintenanceContract, getProduct, getProductMaintenanceContracts, terminateProductMaintenanceContract } from '../../../api/productApi';
import { ProductMaintenanceContractStatusChangeAction } from '../components/ProductMaintenanceContractStatusChangeAction';
import { renderMaintenanceContractStatus } from '../maintenanceContractStatus';
import type { ProductMaintenanceContract } from '../types';

const money = (value: number) => value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ProductMaintenanceContractListPage() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { navigateWithReturn, returnToSource } = usePageReturnNavigation('/products');
  const [contracts, setContracts] = useState<ProductMaintenanceContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    setError('');
    Promise.all([
      getProduct(params.id),
      getProductMaintenanceContracts(params.id).then(setContracts),
    ]).catch((loadError) => {
      const text = loadError instanceof Error ? loadError.message : '加载失败';
      if (text.includes('不存在')) setNotFound(true); else setError(text);
    }).finally(() => setLoading(false));
  }, [params.id, revision]);

  const columns: ProColumns<ProductMaintenanceContract>[] = [
    { title: '合同编号', dataIndex: 'contractCode', width: 150, fixed: 'left', render: (_, contract) => <DetailLinkCell onClick={() => navigateWithReturn(`/products/${contract.productId}/maintenance-contracts/${contract.id}`)}>{contract.contractCode}</DetailLinkCell> },
    { title: '合同名称', dataIndex: 'contractName', width: 210, ellipsis: true },
    { title: '供应商', dataIndex: 'supplierName', width: 180, ellipsis: true },
    { title: '服务开始时间', dataIndex: 'serviceStartDate', width: 130 },
    { title: '服务结束时间', dataIndex: 'serviceEndDate', width: 130 },
    { title: '合同金额（元）', dataIndex: 'contractAmount', width: 140, align: 'right', render: (_, contract) => money(contract.contractAmount) },
    { title: '状态', dataIndex: 'status', width: 110, render: (_, contract) => renderMaintenanceContractStatus(contract.status) },
    { title: '操作', valueType: 'option', width: 220, fixed: 'right', render: (_, contract) => <OperationColumnActions>
      <AdminTextAction onClick={() => navigateWithReturn(`/products/${contract.productId}/maintenance-contracts/${contract.id}/edit`)}>编辑</AdminTextAction>
      {!contract.hasSuccessor ? <AdminTextAction onClick={() => navigateWithReturn(`/products/${contract.productId}/maintenance-contracts/new`)}>续签</AdminTextAction> : null}
      {!contract.hasSuccessor && contract.status !== 'terminated' ? <ProductMaintenanceContractStatusChangeAction contract={contract} variant="text" onTerminated={async (values) => { await terminateProductMaintenanceContract(contract.productId, contract.id, values); setRevision((value) => value + 1); }} /> : null}
      {!contract.hasSuccessor ? <DeleteConfirmAction variant="text" entityName="运维合同" targetName={contract.contractName} successMessage="删除成功" onConfirm={async () => { await deleteProductMaintenanceContract(contract.productId, contract.id); setRevision((value) => value + 1); }}>删除</DeleteConfirmAction> : null}
    </OperationColumnActions> },
  ];

  return <TemplateDetailPage
    title="产品详情"
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
        if (key === 'basic' && params.id) navigate(`/products/${params.id}${location.search}`);
      },
    }}
    actions={params.id ? <PermissionButton permission="product" type="primary" onClick={() => navigateWithReturn(`/products/${params.id}/maintenance-contracts/new`)}>{contracts.length ? '续签运维合同' : '新增运维合同'}</PermissionButton> : null}
  >
    <TemplateDetailTableSection<ProductMaintenanceContract>
      title="运维合同"
      sectionKey="product-contracts"
      summary={`共 ${contracts.length} 份`}
      table={{ columns, dataSource: contracts, rowKey: 'id', scroll: { x: 1280 } }}
    />
  </TemplateDetailPage>;
}
