import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { allowedProjectStatuses } from '../src/modules/project/statusTransitions.ts';
import { allowedTaskStatuses } from '../src/modules/task/statusTransitions.ts';
import { allowedRequirementStatuses, requirementStatusesForType } from '../src/modules/requirement/statusTransitions.ts';
import { statusTransitions, buildStatusPayload } from '../src/modules/work-order/workOrderStatusRules.ts';
import type { RequirementType } from '../src/modules/requirement/types.ts';
import type { ProjectStatus } from '../src/modules/project/types.ts';
import type { WorkOrderStatus } from '../src/modules/work-order/types.ts';
const require = createRequire(import.meta.url);
const project = require('../../backend/src/services/productProjectRules.js');
const task = require('../../backend/src/services/taskRules.js');
const requirement = require('../../backend/src/services/requirementRules.js');
const order = require('../../backend/src/services/workOrderStatusRules.js');

test('关闭及恢复的前端statusTransitions与后端一致，含暂停、完成和禁止目标', () => {
  for (const status of [0, 1, 2, 3, 4] as ProjectStatus[]) {
    assert.deepEqual(allowedProjectStatuses({ status }), project.allowedProjectStatuses(status));
    assert.deepEqual(allowedTaskStatuses({ status }), task.allowedTaskStatuses(status));
  }
  for (const type of [1, 2, 3, 4] as RequirementType[]) {
    for (const status of requirementStatusesForType(type)) {
      assert.deepEqual(allowedRequirementStatuses({ requirementType: type, status }), requirement.allowedRequirementStatuses(type, status));
    }
    assert.ok(requirementStatusesForType(type).includes(37));
  }
  for (const status of [0, 1, 2, 3, 4, 5] as WorkOrderStatus[]) {
    assert.deepEqual(statusTransitions[status], order.allowedWorkOrderStatuses(status));
  }
});

test('工单关闭提交独立关闭字段，不混入暂停字段', () => {
  const payload = buildStatusPayload(3, { closedAt: { format: () => '2026-10-13' }, closeReason: '停止处理' });
  assert.equal(payload.closeDate, '2026-10-13');
  assert.equal(payload.closeReason, '停止处理');
  assert.equal(payload.suspendDate, undefined);
  assert.equal(payload.suspendReason, undefined);
});
