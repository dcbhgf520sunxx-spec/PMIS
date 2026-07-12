import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DetailMetaList, HistoryTimeline, PermissionButton, RichTextViewer, StatusConfirmAction, StatusTag, TemplateDetailPage, TemplateDetailSection } from '../../../components/admin';
import { getProduct, getProductHistory, updateProductStatus } from '../../../api/productApi';
import type { ProductRecord } from '../types';

export function ProductDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [row, setRow] = useState<ProductRecord>();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    Promise.all([
      getProduct(params.id).then(setRow),
      getProductHistory(params.id).then((items) => setHistory(items.map((item) => ({
        id: String(item.id), operator: item.operator, action: item.action,
        time: String(item.created_at).slice(0, 19).replace('T', ' '),
        changes: item.changes.map((change) => ({ field: change.field_name || '-', before: change.old_value, after: change.new_value }))
      }))))
    ]).catch((loadError) => {
      const text = loadError instanceof Error ? loadError.message : '加载失败';
      if (text.includes('不存在')) setNotFound(true); else setError(text);
    }).finally(() => setLoading(false));
  }, [params.id, revision]);

  return (
    <TemplateDetailPage
      title="产品详情" loading={loading} error={error} notFound={notFound}
      onRetry={() => setRevision((value) => value + 1)} onBack={() => navigate('/products')}
      titleTags={row ? <StatusTag status={row.status === 1 ? 'enabled' : 'disabled'} /> : null}
      actions={row ? <PermissionButton permission="product" type="primary" onClick={() => navigate(`/products/${row.id}/edit`)}>编辑</PermissionButton> : null}
      statusSection={row ? { items: [{ label: '状态', value: <StatusTag status={row.status === 1 ? 'enabled' : 'disabled'} />, wide: true }] } : null}
      statusAction={row ? <StatusConfirmAction block type="primary" action={row.status === 1 ? 'disable' : 'enable'} entityName="产品" targetName={row.name} successMessage={row.status === 1 ? '停用成功' : '启用成功'} onConfirm={async () => { const status = row.status === 1 ? 0 : 1; await updateProductStatus(row.id, status); setRow({ ...row, status }); }}>{row.status === 1 ? '停用产品' : '启用产品'}</StatusConfirmAction> : null}
      documentSection={row ? { items: [{ label: '创建人', value: row.creatorName }, { label: '创建时间', value: row.createdAt, wide: true }, { label: '更新人', value: row.updaterName }, { label: '更新时间', value: row.updatedAt, wide: true }] } : null}
    >
      {row ? <><TemplateDetailSection title="基本信息"><DetailMetaList items={[{ label: '产品名称', value: row.name }, { label: '负责人', value: row.ownerName }]} /></TemplateDetailSection><TemplateDetailSection title="产品描述"><RichTextViewer value={row.description || '暂无描述'} /></TemplateDetailSection><TemplateDetailSection title="变更历史"><HistoryTimeline items={history} /></TemplateDetailSection></> : null}
    </TemplateDetailPage>
  );
}
