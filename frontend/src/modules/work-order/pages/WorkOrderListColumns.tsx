import type { ProColumns } from '@ant-design/pro-components';
import {
  AdminInput,
  AdminRangePicker,
  AdminSelect,
  AdminTextAction,
  DeleteConfirmAction,
  DetailLinkCell,
  OperationColumnActions
} from '../../../components/admin';
import type { StatusFlowModalFormValues } from '../../../components/admin';
import { WorkOrderStatusChangeAction } from '../components/WorkOrderStatusChangeAction';
import { richTextToSummary } from '../../../utils/richText';
import type { WorkOrderRecord, WorkOrderStatus } from '../types';
import {
  problemTypeText,
  renderOverdue,
  renderUrgency,
  renderWorkOrderStatus,
  statusOptions,
  urgencyOptions
} from '../helpers';
import type { WorkOrderViewKey } from './workOrderList.types';
import { statusTransitions } from './workOrderList.constants';

type Option = { label: string; value: string };
type SortState = { field?: string; order?: 'ascend' | 'descend' | null };

type CreateWorkOrderColumnsParams = {
  navigate: (path: string) => void;
  renderIndex: (index: number) => number;
  sortState: SortState;
  productOptions: Option[];
  problemTypeOptions: Option[];
  userOptions: Option[];
  viewKey: WorkOrderViewKey;
  onStatusChange: (record: WorkOrderRecord, target: WorkOrderStatus, values: StatusFlowModalFormValues) => Promise<void> | void;
  onOpenDetail: (record: WorkOrderRecord) => void;
  onDelete: (record: WorkOrderRecord) => Promise<void> | void;
};

export function createWorkOrderColumns({
  navigate,
  renderIndex,
  sortState,
  productOptions,
  problemTypeOptions,
  userOptions,
  viewKey,
  onStatusChange,
  onOpenDetail,
  onDelete
}: CreateWorkOrderColumnsParams): ProColumns<WorkOrderRecord>[] {
  return [
    {
      title: '序号',
      width: 48,
      fixed: 'left',
      hideInSetting: true,
      search: false,
      render: (_, __, index) => renderIndex(index)
    },
    {
      title: '问题描述',
      dataIndex: 'problemDesc',
      width: 320,
      fixed: 'left',
      ellipsis: true,
      colSize: 2,
      formItemProps: { label: '问题描述' },
      sorter: true,
      sortOrder: sortState.field === 'problemDesc' ? sortState.order : null,
      renderFormItem: () => <AdminInput placeholder="请输入" />,
      render: (_, record) => {
        const problemSummary = richTextToSummary(record.problemDesc) || '-';
        return (
          <div className="work-order-problem-cell">
            <DetailLinkCell
              className="work-order-problem-cell__text"
              title={problemSummary}
              onClick={() => onOpenDetail(record)}
            >
              {problemSummary}
            </DetailLinkCell>
            {record.isOverdue ? <span className="work-order-problem-cell__tag">{renderOverdue(true, record.expectedResolveDate)}</span> : null}
          </div>
        );
      }
    },
    {
      title: '所属产品',
      dataIndex: 'productName',
      width: 140,
      ellipsis: true,
      sorter: true,
      sortOrder: sortState.field === 'productName' ? sortState.order : null,
      render: (_, record) => record.productName || '-',
      renderFormItem: () => <AdminSelect options={productOptions} />
    },
    {
      title: '问题类型',
      dataIndex: 'problemType',
      width: 100,
      sorter: true,
      sortOrder: sortState.field === 'problemType' ? sortState.order : null,
      render: (_, record) => problemTypeText(record.problemType, record.problemTypeName),
      renderFormItem: () => <AdminSelect options={problemTypeOptions} />
    },
    {
      title: '跟进人',
      dataIndex: 'followerId',
      width: 80,
      search: viewKey === 'all',
      sorter: true,
      sortOrder: sortState.field === 'followerId' ? sortState.order : null,
      render: (_, record) => record.followerName || '-',
      renderFormItem: () => <AdminSelect options={userOptions} />
    },
    {
      title: '紧急程度',
      dataIndex: 'urgency',
      width: 96,
      sorter: true,
      sortOrder: sortState.field === 'urgency' ? sortState.order : null,
      render: (_, record) => renderUrgency(record.urgency),
      renderFormItem: () => <AdminSelect options={urgencyOptions} />
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 104,
      sorter: true,
      sortOrder: sortState.field === 'status' ? sortState.order : null,
      render: (_, record) => renderWorkOrderStatus(record.status),
      renderFormItem: () => <AdminSelect options={statusOptions} />
    },
    {
      title: '逾期',
      dataIndex: 'isOverdue',
      hideInTable: true,
      renderFormItem: () => (
        <AdminSelect
          options={[
            { label: '未逾期', value: false },
            { label: '逾期', value: true }
          ]}
        />
      )
    },
    {
      title: '提出人',
      dataIndex: 'submitterName',
      width: 80,
      sorter: true,
      sortOrder: sortState.field === 'submitterName' ? sortState.order : null,
      renderFormItem: () => <AdminInput placeholder="请输入" />
    },
    {
      title: '提出时间',
      dataIndex: 'submitTime',
      width: 130,
      search: false,
      sorter: true,
      sortOrder: sortState.field === 'submitTime' ? sortState.order : null,
      render: (_, record) => record.submitTime.slice(0, 10)
    },
    {
      title: '预计完成时间',
      dataIndex: 'expectedResolveDate',
      width: 130,
      search: false,
      sorter: true,
      sortOrder: sortState.field === 'expectedResolveDate' ? sortState.order : null
    },
    {
      title: '创建人',
      dataIndex: 'creatorName',
      width: 80,
      search: false,
      sorter: true,
      sortOrder: sortState.field === 'creatorName' ? sortState.order : null
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      search: false,
      sorter: true,
      sortOrder: sortState.field === 'createdAt' ? sortState.order : null
    },
    {
      title: '提出时间',
      dataIndex: 'submitTimeRange',
      hideInTable: true,
      renderFormItem: () => <AdminRangePicker />
    },
    {
      title: '预计完成时间',
      dataIndex: 'expectedResolveDateRange',
      hideInTable: true,
      renderFormItem: () => <AdminRangePicker />
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <OperationColumnActions>
          <AdminTextAction onClick={() => navigate(`/work-orders/${record.id}/edit`)}>
            编辑
          </AdminTextAction>
          <WorkOrderStatusChangeAction
            variant="text"
            workOrder={record}
            statusOptions={statusOptions.filter((item) => statusTransitions[record.status].includes(item.value))}
            onConfirm={(target, values) => onStatusChange(record, target, values)}
          >
            状态变更
          </WorkOrderStatusChangeAction>
          <AdminTextAction onClick={() => navigate(`/work-orders/${record.id}/copy`)}>
            复制
          </AdminTextAction>
          <DeleteConfirmAction
            variant="text"
            entityName="工单"
            targetName={record.code}
            onConfirm={() => onDelete(record)}
            successMessage={false}
          >
            删除
          </DeleteConfirmAction>
        </OperationColumnActions>
      )
    }
  ];
}
