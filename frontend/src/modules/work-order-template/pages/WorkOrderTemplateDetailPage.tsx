import { useState } from 'react';
import { message } from 'antd';
import { useParams } from 'react-router-dom';
import {
  AdminButton,
  DeleteConfirmAction,
  DetailMetaList,
  HistoryTimelineSection,
  RichTextViewer,
  TemplateDetailPage,
  TemplateDetailSection,
  usePageReturnNavigation
} from '../../../components/admin';
import { WorkOrderStatusChangeAction } from '../../work-order/components/WorkOrderStatusChangeAction';
import { mockWorkOrderHistory, mockWorkOrders } from '../../work-order/mock';
import type { WorkOrderStatus } from '../../work-order/types';
import {
  problemTypeText,
  renderOverdue,
  renderUrgency,
  renderWorkOrderStatus,
  statusOptions,
  statusText
} from '../../work-order/helpers';
import '../../work-order/pages/WorkOrderDetailPage.css';

export function WorkOrderTemplateDetailPage() {
  const { navigateWithReturn, returnToSource } = usePageReturnNavigation('/samples/work-order');
  const params = useParams();
  const detail = mockWorkOrders.find((item) => item.id === params.id);
  if (!detail) {
    return (
      <TemplateDetailPage
        title="工单详情样板"
        notFound
        onBack={returnToSource}
      >
        {null}
      </TemplateDetailPage>
    );
  }
  const nextStatuses = statusOptions.filter((item) => item.value > detail.status);
  return (
    <TemplateDetailPage
      title="工单详情样板"
      onBack={returnToSource}
      titleCode={detail.code}
      actions={
        <>
          <AdminButton type="primary" onClick={() => navigateWithReturn(`/samples/work-order/${detail.id}/edit`)}>编辑</AdminButton>
          <AdminButton onClick={() => navigateWithReturn(`/samples/work-order/${detail.id}/copy`)}>复制</AdminButton>
          <DeleteConfirmAction
            entityName="工单"
            targetName={detail.code}
            onConfirm={() => {
              message.success('样板工单已删除');
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
          { label: '逾期', value: detail.status < 2 ? renderOverdue(detail.isOverdue) : '-' }
        ]
      }}
      statusAction={(
        <WorkOrderStatusChangeAction
          block
          type="primary"
          workOrder={detail}
          statusOptions={nextStatuses}
          onConfirm={(target) => {
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
                { label: '问题类型', value: problemTypeText(detail.problemType) }
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
                { label: '处置结果', value: detail.resultDesc || '暂无处置结果', wide: true }
              ]}
            />
          </TemplateDetailSection>

          <HistoryTimelineSection items={mockWorkOrderHistory} />

    </TemplateDetailPage>
  );
}
