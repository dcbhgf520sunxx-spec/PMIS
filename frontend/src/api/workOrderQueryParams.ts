export type WorkOrderListParams = {
  problemDesc?: string;
  systemId?: string;
  problemType?: string | string[];
  urgency?: number;
  status?: number;
  isOverdue?: boolean;
  filterFollowerId?: string;
  viewKey?: 'all' | 'mine';
  currentUserId?: string;
  submitterName?: string;
  submitTimeFrom?: string;
  submitTimeTo?: string;
  expectedResolveDateFrom?: string;
  expectedResolveDateTo?: string;
  current?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: 'ascend' | 'descend';
};

export function toWorkOrderSortField(field?: string) {
  const sortMap: Record<string, string> = {
    problemDesc: 'problem_desc',
    systemName: 'system_id',
    problemType: 'problem_type',
    followerId: 'follower_id',
    urgency: 'urgency',
    status: 'status',
    isOverdue: 'is_overdue',
    submitterName: 'submitter_name',
    submitterDept: 'submitter_dept',
    submitTime: 'submit_time',
    expectedResolveDate: 'expected_resolve_date',
    creatorName: 'creator_name',
    createdAt: 'created_at'
  };
  return field ? sortMap[field] || field : undefined;
}

export function buildWorkOrderQueryParams(params: WorkOrderListParams = {}) {
  return {
    problem_desc: params.problemDesc,
    system_id: params.systemId,
    problem_type: Array.isArray(params.problemType) ? params.problemType.join(',') : params.problemType,
    urgency: params.urgency,
    status: params.status,
    is_overdue: params.isOverdue === undefined ? undefined : Number(params.isOverdue),
    filter_follower_id: params.filterFollowerId,
    view_key: params.viewKey,
    current_user_id: params.currentUserId,
    submitter_name: params.submitterName,
    submit_time_from: params.submitTimeFrom,
    submit_time_to: params.submitTimeTo,
    expected_resolve_date_from: params.expectedResolveDateFrom,
    expected_resolve_date_to: params.expectedResolveDateTo,
    page: params.current,
    pageSize: params.pageSize,
    sort_field: toWorkOrderSortField(params.sortField),
    sort_order: params.sortOrder
  };
}
