export type BugStatus = 0 | 1 | 2 | 3;
export type BugSeverity = 1 | 2 | 3 | 4;

export type BugRecord = {
  id: string;
  title: string;
  description: string;
  sourceType: 1 | 2;
  projectId: string;
  projectName: string;
  requirementId: string;
  requirementName: string;
  bugTypeId: string;
  bugTypeName: string;
  severity: BugSeverity;
  status: BugStatus;
  assigneeId: string;
  assigneeName: string;
  resolutionId: string;
  resolutionName: string;
  resolvedTime: string;
  closedTime: string;
  activationReason: string;
  creatorName: string;
  updaterName: string;
  createdAt: string;
  updatedAt: string;
};

export type BugFormValues = {
  title: string;
  description?: string;
  sourceType: 1 | 2;
  projectId?: string;
  requirementId?: string;
  bugTypeId: string;
  severity: BugSeverity;
  assigneeId: string;
};
