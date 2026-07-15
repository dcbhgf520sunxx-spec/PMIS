import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const statusActions = [
  'src/modules/project/components/ProjectStatusChangeAction.tsx',
  'src/modules/requirement/components/RequirementStatusChangeAction.tsx',
  'src/modules/task/components/TaskStatusChangeAction.tsx',
  'src/modules/bug/components/BugStatusChangeAction.tsx',
  'src/modules/work-order/components/WorkOrderStatusChangeAction/index.tsx'
];

test('所有单据状态变更的目标状态附加字段默认置空', () => {
  for (const file of statusActions) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /renderExtra=/, `${file} 应声明目标状态附加字段`);
    assert.doesNotMatch(source, /\sformValues=/, `${file} 不应向状态弹窗回填旧值`);
  }
});

test('工单批量状态变更不再保留旧完成值开关', () => {
  const action = readFileSync('src/modules/work-order/components/WorkOrderStatusChangeAction/index.tsx', 'utf8');
  const batch = readFileSync('src/modules/work-order/pages/useWorkOrderBatchActions.tsx', 'utf8');
  assert.doesNotMatch(action, /preserveCompletedValues/);
  assert.doesNotMatch(batch, /preserveCompletedValues/);
});
