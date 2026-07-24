export type ProjectStatus = 0 | 1 | 2 | 3;
export type ProjectMember = { id: string; name: string };
export type ProjectRecord = {
  id: string; name: string; description: string; productId: string; productName: string;
  ownerId: string; ownerName: string; memberIds: string[]; members: ProjectMember[];
  status: ProjectStatus; isOverdue: boolean; startDate: string; expectedEndDate: string;
  previousStatus?: ProjectStatus;
  actualEndDate: string; suspendDate: string; progressText: string; riskText: string;
  creatorName: string; updaterName: string; createdAt: string; updatedAt: string;
};
export type ProjectFormValues = { name: string; productId: string; ownerId: string; memberIds?: string[]; startDate?: string; expectedEndDate: string; description?: string; progressText?: string; riskText?: string };

export type ProjectPaymentStatus = 0 | 1 | 2;
export type ProjectPaymentStage = {
  id: string;
  contractId: string;
  stageName: string;
  plannedAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  paymentStatus: ProjectPaymentStatus;
  sortOrder: number;
};
export type ProjectContractAttachment = {
  id: string;
  contractId: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  sortOrder: number;
  creatorName: string;
  createdAt: string;
};
export type ProjectContractRecord = {
  id: string;
  projectId: string;
  projectName: string;
  contractCode: string;
  contractName: string;
  supplierId: string;
  supplierName: string;
  signedDate: string;
  contractAmount: number;
  remark: string;
  paidAmount: number;
  paymentCount: number;
  unpaidAmount: number;
  stages: ProjectPaymentStage[];
  attachments: ProjectContractAttachment[];
};
export type ProjectContractFormValues = {
  contractCode: string;
  contractName: string;
  supplierId: string;
  signedDate: string;
  contractAmount: string;
  remark?: string;
  stages: Array<{ id?: string; stageName: string; paymentRatio: string; plannedAmount: string }>;
};
export type ProjectPaymentRecord = {
  id: string;
  stageId: string;
  paymentAmount: number;
  paymentMonth: string;
  handlerId: string;
  handlerName: string;
  remark: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
};
export type ProjectPaymentFormValues = {
  paymentAmount: string;
  paymentMonth: string;
  handlerId: string;
  remark?: string;
};
