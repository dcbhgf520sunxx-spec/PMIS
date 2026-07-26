import assert from 'node:assert/strict';
import test from 'node:test';

import * as projectPlanRowSort from '../src/modules/project/projectPlanRowSort.ts';

const { resolveProjectPlanRowOrder } = projectPlanRowSort;

const stageOne = { key: 'stage-1', kind: 'stage', stage: { id: '1' } };
const stageTwo = { key: 'stage-2', kind: 'stage', stage: { id: '2' } };
const itemOne = { key: 'item-11', kind: 'item', stage: { id: '1' }, item: { id: '11' } };
const itemTwo = { key: 'item-12', kind: 'item', stage: { id: '1' }, item: { id: '12' } };
const itemOtherStage = { key: 'item-21', kind: 'item', stage: { id: '2' }, item: { id: '21' } };
const stages = [
  { id: '1', items: [{ id: '11' }, { id: '12' }] },
  { id: '2', items: [{ id: '21' }] }
];

test('阶段拖拽只提交阶段的新顺序', () => {
  const result = resolveProjectPlanRowOrder(
    stages,
    stageOne,
    stageTwo
  );

  assert.deepEqual(result, { kind: 'stage', ids: ['2', '1'] });
});

test('同阶段关键事项拖拽只提交该阶段事项的新顺序', () => {
  const result = resolveProjectPlanRowOrder(
    stages,
    itemOne,
    itemTwo
  );

  assert.deepEqual(result, { kind: 'item', stageId: '1', ids: ['12', '11'] });
});

test('关键事项不能跨阶段拖拽排序', () => {
  const result = resolveProjectPlanRowOrder(
    stages,
    itemOne,
    itemOtherStage
  );

  assert.equal(result, undefined);
});

test('阶段汇总把进度逾期和最后计划时间拆到对应位置', () => {
  const summary = projectPlanRowSort.getProjectPlanStagePresentation?.({
    completedCount: 1,
    itemCount: 3,
    maxDueDate: '2026-08-09',
    overdueCount: 2
  });

  assert.deepEqual(summary, {
    progressText: '已完成 1/3',
    overdueText: '已逾期 2 项',
    dueDate: '2026-08-09'
  });
});

test('阶段没有逾期时不生成逾期提示', () => {
  const summary = projectPlanRowSort.getProjectPlanStagePresentation?.({
    completedCount: 0,
    itemCount: 2,
    maxDueDate: '2026-08-09',
    overdueCount: 0
  });

  assert.deepEqual(summary, {
    progressText: '已完成 0/2',
    overdueText: undefined,
    dueDate: '2026-08-09'
  });
});
