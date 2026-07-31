export type ProjectPlanSortableRow = {
  key: string;
  kind: 'stage' | 'item';
  stage: { id: string };
  item?: { id: string };
};

export type ProjectPlanRowOrder =
  | { kind: 'stage'; ids: string[] }
  | { kind: 'item'; stageId: string; ids: string[] };

type ProjectPlanSortableStage = {
  id: string;
  items: Array<{ id: string }>;
};

type ProjectPlanStageSummary = {
  completedCount: number;
  itemCount: number;
  maxDueDate?: string | null;
  actualEndDate?: string | null;
  overdueCount?: number;
};

export function getProjectPlanStagePresentation(stage: ProjectPlanStageSummary) {
  return {
    progressText: `已完成 ${stage.completedCount}/${stage.itemCount}`,
    overdueText: stage.overdueCount && stage.overdueCount > 0
      ? `已逾期 ${stage.overdueCount} 项`
      : undefined,
    dueDate: stage.maxDueDate || '',
    actualEndDate: stage.itemCount > 0 && stage.completedCount === stage.itemCount
      ? (stage.actualEndDate || '')
      : ''
  };
}

function moveId(ids: string[], activeId: string, targetId: string) {
  const fromIndex = ids.indexOf(activeId);
  const toIndex = ids.indexOf(targetId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return ids;

  const nextIds = [...ids];
  nextIds.splice(toIndex, 0, ...nextIds.splice(fromIndex, 1));
  return nextIds;
}

export function resolveProjectPlanRowOrder(
  stages: readonly ProjectPlanSortableStage[],
  active: ProjectPlanSortableRow,
  target: ProjectPlanSortableRow
): ProjectPlanRowOrder | undefined {
  if (active.kind === 'stage' && target.kind === 'stage') {
    return {
      kind: 'stage',
      ids: moveId(stages.map((stage) => stage.id), active.stage.id, target.stage.id)
    };
  }

  if (
    active.kind === 'item'
    && target.kind === 'item'
    && active.item
    && target.item
    && active.stage.id === target.stage.id
  ) {
    const stage = stages.find((item) => item.id === active.stage.id);
    if (!stage) return undefined;
    return {
      kind: 'item',
      stageId: active.stage.id,
      ids: moveId(stage.items.map((item) => item.id), active.item.id, target.item.id)
    };
  }

  return undefined;
}
