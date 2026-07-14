import { useEffect, useState } from 'react';
import { message } from 'antd';
import { useParams } from 'react-router-dom';
import {
  AdminButton,
  DeleteConfirmAction,
  DetailNeighborNav,
  DetailMetaList,
  HistoryTimelineSection,
  RichTextViewer,
  TemplateDetailPage,
  TemplateDetailSection,
  useDetailNeighbors,
  usePageReturnNavigation
} from '../../../components/admin';
import { WorkOrderStatusChangeAction } from '../components/WorkOrderStatusChangeAction';
import { deleteWorkOrder, getWorkOrder, getWorkOrderHistory, getWorkOrderNeighbors, updateWorkOrderStatus } from '../../../api/workOrderApi';
import type { WorkOrderHistoryItem, WorkOrderRecord, WorkOrderStatus } from '../types';
import {
  problemTypeText,
  renderOverdue,
  renderUrgency,
  renderWorkOrderStatus,
  statusOptions,
  statusText
} from '../helpers';
import './WorkOrderDetailPage.css';
import { buildStatusPayload, statusTransitions } from './workOrderList.constants';

export function WorkOrderDetailPage() {
  const { navigateWithReturn, returnToSource } = usePageReturnNavigation('/work-orders');
  const params = useParams();
  const [detail, setDetail] = useState<WorkOrderRecord>();
  const [history, setHistory] = useState<WorkOrderHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const neighbors = useDetailNeighbors({
    id: params.id,
    moduleKey: 'work-order',
    routeBase: '/work-orders',
    fetchNeighbors: getWorkOrderNeighbors
  });

  const loadDetail = async () => {
    if (!params.id) return;
    setLoading(true);
    setLoadError('');
    setNotFound(false);
    setDetail(undefined);
    try {
      const [record, logs] = await Promise.all([
        getWorkOrder(params.id),
        getWorkOrderHistory(params.id)
      ]);
      setDetail(record);
      setHistory(logs);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : '工单加载失败';
      if (messageText.includes('不存在')) setNotFound(true);
      else setLoadError(messageText);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [params.id]);

  if (!detail) {
    return (
      <TemplateDetailPage
        title="工单详情"
        loading={loading}
        error={loadError}
        notFound={notFound}
        onRetry={loadDetail}
        onBack={returnToSource}
      >
        {null}
      </TemplateDetailPage>
    );
  }

  const nextStatuses = statusOptions.filter((item) => statusTransitions[detail.status].includes(item.value));
  return (
    <TemplateDetailPage
      title="工单详情"
      onBack={returnToSource}
      titleCode={detail.code}
      titleCenter={(
        <DetailNeighborNav
          placement="title"
          loading={neighbors.loading}
          prevId={neighbors.prevId}
          nextId={neighbors.nextId}
          ordinal={neighbors.ordinal}
          total={neighbors.total}
          onNavigate={neighbors.navigateNeighbor}
        />
      )}
      actions={
        <>
          <AdminButton type="primary" onClick={() => navigateWithReturn(`/work-orders/${detail.id}/edit`)}>编辑</AdminButton>
          <AdminButton onClick={() => navigateWithReturn(`/work-orders/${detail.id}/copy`)}>复制</AdminButton>
          <DeleteConfirmAction
            entityName="工单"
            targetName={detail.code}
            onConfirm={async () => {
              await deleteWorkOrder(detail.id);
              message.success('工单已删除');
              returnToSource();
            }}
            successMessage={false}
          >
            删除
          </DeleteConfirmAction>
        </>
      }
      statusSection={{
        items: [
          { label: '状态', value: renderWorkOrderStatus(detail.status) },
          { label: '紧急程度', value: renderUrgency(detail.urgency) },
          { label: '逾期', value: detail.status < 2 ? renderOverdue(detail.isOverdue, detail.expectedResolveDate) : '-' }
        ]
      }}
      statusAction={(
        <WorkOrderStatusChangeAction
          block
          type="primary"
          workOrder={detail}
          statusOptions={nextStatuses}
          onConfirm={async (target, values) => {
            await updateWorkOrderStatus(detail.id, buildStatusPayload(target, values));
            await loadDetail();
            message.success(`状态已更新为 ${statusText(target)}`);
          }}
        >
          状态变更
        </WorkOrderStatusChangeAction>
      )}
      documentSection={{
        items: [
          { label: '创建人', value: detail.creatorName },
          { label: '创建时间', value: detail.createdAt, wide: true },
          { label: '更新人', value: detail.updaterName || '-' },
          { label: '更新时间', value: detail.updatedAt || '-', wide: true }
        ]
      }}
    >
          <TemplateDetailSection title="基本信息">
            <div className="work-order-detail-page__issue-summary">
              <div className="work-order-detail-page__issue-content">
                <span className="work-order-detail-page__issue-label">问题描述</span>
                <div className="work-order-detail-page__issue-title">
                  <RichTextViewer value={detail.problemDesc} />
                </div>
              </div>
            </div>
            <DetailMetaList
              items={[
                { label: '所属系统', value: detail.systemName },
                { label: '问题类型', value: problemTypeText(detail.problemType, detail.problemTypeName) }
              ]}
            />
          </TemplateDetailSection>

          <TemplateDetailSection title="处理信息">
            <DetailMetaList
              items={[
                { label: '提出人', value: detail.submitterName },
                { label: '提出组织', value: detail.submitterDept },
                { label: '提出时间', value: detail.submitTime },
                { label: '跟进人', value: detail.followerName || '-' },
                { label: '预计完成时间', value: detail.expectedResolveDate },
                { label: '实际修复时间', value: detail.resolveDate || '-' },
                { label: '关闭时间', value: detail.closeDate || '-' },
                { label: '处置结果', value: detail.resultDesc || '-', wide: true }
              ]}
            />
          </TemplateDetailSection>

          <HistoryTimelineSection items={history} />

    </TemplateDetailPage>
  );
}
