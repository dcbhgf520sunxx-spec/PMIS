export type TaskStatus = 0 | 1 | 2 | 3;
export type TaskPriority = 0 | 1 | 2;
export type TaskOwner = { id: string; name: string };

export type TaskRecord = {
  id: string;
  name: string;
  description: string;
  parentTaskId: string;
  parentTaskName: string;
  childCount: number;
  completedChildCount: number;
  sourceType: 1 | 2;
  projectId: string;
  projectName: string;
  requirementId: string;
  requirementName: string;
  ownerIds: string[];
  owners: TaskOwner[];
  ownerNames: string;
  taskType: string;
  taskTypeName: string;
  priority: TaskPriority;
  status: TaskStatus;
  previousStatus?: TaskStatus;
  isOverdue: boolean;
  startTime: string;
  expectedEndTime: string;
  actualEndTime: string;
  suspendTime: string;
  creatorName: string;
  updaterName: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskFormValues = {
  name: string;
  description?: string;
  parentTaskName?: string;
  sourceType: 1 | 2;
  projectId?: string;
  requirementId?: string;
  ownerIds: string[];
  taskType: string;
  priority: TaskPriority;
  startTime?: string;
  expectedEndTime?: string;
};

export type TaskStatusUpdateResult = {
  allSubtasksCompleted: boolean;
  parentTaskId: string;
};
