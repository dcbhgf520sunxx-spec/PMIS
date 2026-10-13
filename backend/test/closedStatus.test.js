const test = require('node:test')
const assert = require('node:assert/strict')
const requirement = require('../src/services/requirementRules')
const project = require('../src/services/productProjectRules')
const task = require('../src/services/taskRules')
const order = require('../src/services/workOrderStatusRules')
const { calculateOverdue, overdueSql } = require('../src/services/overdueRules')
const { allowedBugStatuses } = require('../src/services/bugRules')

test('项目和任务关闭入口、恢复目标与暂停对应，仍拒绝跨级流转', () => {
  for (const allowed of [project.allowedProjectStatuses, task.allowedTaskStatuses]) {
    assert.deepEqual(allowed(0), [1, 3, 4])
    assert.deepEqual(allowed(1), [2, 3, 4])
    assert.deepEqual(allowed(2), [3, 4])
    assert.deepEqual(allowed(3), [0, 1, 2, 4])
    assert.deepEqual(allowed(4), [0, 1, 2, 3])
  }
})

test('关闭校验必填时间、非空原因及200字上限', () => {
  for (const [validate, status] of [[project.validateProjectStatusChange, 4], [task.validateTaskStatusChange, 4], [requirement.validateRequirementStatusChange, 37]]) {
    assert.match(validate(status, {}), /关闭.*(时间|日期)/)
    assert.match(validate(status, { close_date: '2026-10-13', close_reason: ' ' }), /关闭原因/)
    assert.match(validate(status, { close_date: '2026-10-13', close_reason: 'a'.repeat(201) }), /200/)
    assert.equal(validate(status, { close_date: '2026-10-13', close_reason: '不再继续' }), null)
    assert.match(validate(status, { close_date: '2026-10-14', close_reason: '停止' }, '2026-10-13'), /不能晚于今天/)
    assert.match(validate(status, { close_date: '2026-02-30', close_reason: '停止' }, '2026-10-13'), /格式不正确/)
  }
})

test('需求关闭按路径恢复，已转项目继续禁止普通状态操作', () => {
  for (const [type, initial] of [[1, 0], [2, 10], [3, 20], [4, 30]]) {
    assert.ok(requirement.allowedRequirementStatuses(type, initial).includes(37))
    assert.deepEqual(requirement.allowedRequirementStatuses(type, 37).filter(x => x !== 35), requirement.allowedRequirementStatuses(type, 35).filter(x => x !== 37))
    assert.ok(requirement.allowedRequirementStatuses(type, 37).includes(35))
    assert.deepEqual(requirement.allowedRequirementStatuses(type, 36), [])
    assert.equal(requirement.resolveRequirementTypeChange(type, 37, type === 1 ? 2 : 1).allowed, false)
    assert.equal(requirement.validateRequirementRelease(type, { status: 37, close_date: '2026-10-13', close_reason: '停止实施' }), null)
  }
})

test('任务和需求关闭保留完成信息，恢复后清空当前关闭字段', () => {
  const fields = task.resolveTaskStatusFields({ status: 2, actual_end_date: '2026-10-12' }, 4, { close_date: '2026-10-13', close_reason: '  停止  ' })
  assert.equal(fields.actualEndDate, '2026-10-12')
  assert.equal(fields.closeDate, '2026-10-13')
  assert.equal(fields.closeReason, '停止')
  assert.equal(fields.suspendDate, null)
  assert.equal(task.resolveTaskStatusFields({ status: 4 }, 1).closeDate, null)
  const r = requirement.resolveRequirementStatusFields({ status: 33, actual_end_date: '2026-10-12', completion_status: '已完成' }, 37, { close_date: '2026-10-13', close_reason: '停止' })
  assert.equal(r.actualEndDate, '2026-10-12')
  assert.equal(r.completionStatus, '已完成')
  assert.equal(r.closeReason, '停止')
  assert.equal(requirement.resolveRequirementStatusFields({ status: 37 }, 31).closeReason, null)
})

test('工单关闭对应暂停流转并保留处理结果，恢复清空关闭原因', () => {
  assert.deepEqual(order.allowedWorkOrderStatuses(0), [1, 2, 4, 3])
  assert.deepEqual(order.allowedWorkOrderStatuses(1), [2, 4, 3])
  assert.deepEqual(order.allowedWorkOrderStatuses(2), [4, 5, 3])
  assert.deepEqual(order.allowedWorkOrderStatuses(3), [0, 1, 2, 4])
  assert.deepEqual(order.allowedWorkOrderStatuses(4), [0, 1, 2, 3])
  assert.deepEqual(order.allowedWorkOrderStatuses(5), [2])
  const fields = order.resolveWorkOrderResultFields(3, { close_date: '2026-10-13', close_reason: '停止服务' }, { resolve_date: '2026-10-12', result_desc: '已有结果' })
  assert.equal(fields.resultDesc, '已有结果')
  assert.equal(fields.closeDate, '2026-10-13')
  assert.equal(fields.closeReason, '停止服务')
  assert.equal(order.validateWorkOrderResultFields(3, fields), '')
  assert.match(order.validateWorkOrderResultFields(3, order.resolveWorkOrderResultFields(3)), /关闭时间/)
  assert.match(order.validateWorkOrderResultFields(3, order.resolveWorkOrderResultFields(3, { close_date: '2026-10-13' })), /关闭原因/)
  assert.equal(order.resolveWorkOrderResultFields(1, {}, { status: 3, close_date: '2026-10-13', close_reason: '停止' }).closeDate, null)
  assert.equal(order.resolveWorkOrderResultFields(1, {}, { status: 3 }).closeReason, null)
  assert.match(order.validateWorkOrderResultFields(3, { closeDate: '2026-10-14', closeReason: '停止' }, '2026-10-13'), /不能晚于今天/)
})

test('关闭不计当前逾期，关闭项目的关键事项同暂停项目排除逾期', () => {
  for (const [type, status] of [['project', 4], ['task', 4], ['requirement', 37], ['work_order', 3]]) {
    assert.notEqual(calculateOverdue(type, { status, date: '2026-01-01' }, '2026-10-13').isOverdue, 1)
    assert.ok(overdueSql(type).flag.includes(String(status)))
  }
  assert.equal(calculateOverdue('stage_plan', { status: 1, parentStatus: 4, date: '2026-01-01' }, '2026-10-13').isOverdue, 0)
  assert.match(overdueSql('stage_plan', { parentAlias: 'p' }).predicate, /p.status NOT IN \(3,4\)/)
  assert.deepEqual(allowedBugStatuses(2), [3])
})

test('MCP关闭预览接受文本原因并且只签发确认号，不执行写入', async () => {
  const { dispatchActionTool } = require('../src/mcp/actionTools')
  for (const [name, status, row] of [
    ['project_change_status', 4, { status: 1 }],
    ['task_change_status', 4, { status: 1, parent_task_id: null }],
    ['requirement_change_status', 37, { status: 31, requirement_type: 4 }],
    ['work_order_change_status', 3, { status: 1 }],
  ]) {
    const preview = await dispatchActionTool(name, { id: 1, status, mode: 'preview', close_date: '2026-10-13', close_reason: '停止，待后续恢复' }, {
      client: { id: 1 }, user: { id: 1, employeeNo: 'QA', realName: '验收' },
    }, {
      database: { prepare: () => ({ get: async () => row }) },
      loadTarget: async () => ({ type: name.split('_')[0], id: 1, name: '验收单据', current: { owner_id: 1, follower_id: 1, owner_ids: [1] } }),
      ticketService: { createTicket: async () => ({ confirmationId: 'qa-confirmation' }) },
    })
    assert.equal(preview.executed, false)
    assert.equal(preview.confirmationId, 'qa-confirmation')
    assert.equal(preview.executeArguments.close_reason, '停止，待后续恢复')
  }
})
