import { useState } from 'react';
import { Button, message, Space, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ActionBar,
  AdminTextAction,
  ConfirmAction,
  DetailMetaList,
  HistoryTimeline,
  RichTextViewer,
  TemplateDetailPage,
  TemplateDetailSection
} from '../../../components/admin';
import { StatusChangeModal } from '../../work-order/components/StatusChangeModal';
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
  const navigate = useNavigate();
  const params = useParams();
  const [statusOpen, setStatusOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<WorkOrderStatus | undefined>();
  const [historyExpandedKeys, setHistoryExpandedKeys] = useState<string[]>([]);
  const detail = mockWorkOrders.find((item) => item.id === params.id) || mockWorkOrders[0];
  const nextStatuses = statusOptions.filter((item) => item.value > detail.status);
  const expandableHistoryKeys = mockWorkOrderHistory.filter((item) => item.changes?.length).map((item) => item.id);
  const isAllHistoryExpanded =
    expandableHistoryKeys.length > 0 && expandableHistoryKeys.every((key) => historyExpandedKeys.includes(key));

  return (
    <TemplateDetailPage
      title="工单详情样板"
      titleExtra={(
        <Space size={8} className="admin-template-detail-page__title-extra">
          <span className="admin-template-detail-page__code">{detail.code}</span>
          {renderWorkOrderStatus(detail.status)}
          {renderUrgency(detail.urgency)}
          {detail.status < 2 ? renderOverdue(detail.isOverdue) : null}
        </Space>
      )}
      actions={
        <ActionBar>
          <Button onClick={() => navigate('/samples/work-order')}>返回列表</Button>
          <Button type="primary" onClick={() => navigate(`/samples/work-order/${detail.id}/edit`)}>编辑</Button>
          <Button onClick={() => navigate(`/samples/work-order/${detail.id}/copy`)}>复制</Button>
          <ConfirmAction
            danger
            title="确认删除"
            description="样板页不执行真实删除，确认后返回列表。"
            onConfirm={() => {
              message.success('样板工单已删除');
              navigate('/samples/work-order');
            }}
            successMessage={false}
          >
            删除
          </ConfirmAction>
        </ActionBar>
      }
      statusSection={{
        children: (
          <>
            <div className="work-order-detail-page__status-card">
              <div className="work-order-detail-page__status-row">
                <span>状态</span>
                {renderWorkOrderStatus(detail.status)}
              </div>
              <div className="work-order-detail-page__status-row">
                <span>紧急程度</span>
                {renderUrgency(detail.urgency)}
              </div>
              <div className="work-order-detail-page__status-row">
                <span>逾期</span>
                {detail.status < 2 ? renderOverdue(detail.isOverdue) : <Typography.Text type="secondary">-</Typography.Text>}
              </div>
            </div>
            <Space direction="vertical" size={8} className="work-order-detail-page__side-actions">
              <Button block type="primary" onClick={() => {
                setTargetStatus(undefined);
                setStatusOpen(true);
              }}
              >
                状态变更
              </Button>
            </Space>
          </>
        )
      }}
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

          <TemplateDetailSection
            title="变更历史"
            inlineExtra={expandableHistoryKeys.length > 0 ? (
                <AdminTextAction
                  onClick={() => setHistoryExpandedKeys(isAllHistoryExpanded ? [] : expandableHistoryKeys)}
                >
                  {isAllHistoryExpanded ? '全部收起' : '全部展开'}
                </AdminTextAction>
            ) : null}
          >
            <HistoryTimeline
              items={mockWorkOrderHistory}
              expandedKeys={historyExpandedKeys}
              onExpandedKeysChange={setHistoryExpandedKeys}
            />
          </TemplateDetailSection>

      <StatusChangeModal
        open={statusOpen}
        workOrder={detail}
        targetStatus={targetStatus}
        statusOptions={nextStatuses}
        onTargetStatusChange={setTargetStatus}
        onCancel={() => {
          setStatusOpen(false);
          setTargetStatus(undefined);
        }}
        onConfirm={() => {
          if (targetStatus === undefined) return;
          message.success(`状态已更新为 ${statusText(targetStatus)}`);
          setStatusOpen(false);
          setTargetStatus(undefined);
        }}
      />
    </TemplateDetailPage>
  );
}
