export type WorkOrderStatus = 0 | 1 | 2 | 3 | 4 | 5;
export type WorkOrderUrgency = 0 | 1 | 2;
export type WorkOrderProblemType = string;

export type WorkOrderRecord = Record<string, unknown> & {
  id: string;
  code: string;
  productId: string;
  productName: string;
  problemDesc: string;
  problemType: WorkOrderProblemType;
  problemTypeName: string;
  followerId: string;
  followerName: string;
  urgency: WorkOrderUrgency;
  status: WorkOrderStatus;
  isOverdue: boolean;
  expectedResolveDate: string;
  submitterName: string;
  submitterDept: string;
  submitTime: string;
  resolveDate?: string;
  closeDate?: string;
  suspendDate?: string;
  resultDesc?: string;
  activationReason?: string;
  creatorName: string;
  createdAt: string;
  updaterName?: string;
  updatedAt?: string;
};

export type WorkOrderHistoryItem = {
  id: string;
  operator: string;
  action: string;
  time: string;
  remark?: string;
  changes?: Array<{
    field: string;
    before?: string;
    after?: string;
  }>;
};
