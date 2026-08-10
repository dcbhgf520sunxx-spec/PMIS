const test = require('node:test')
const assert = require('node:assert/strict')
const {
  PLAN_ITEM_STATUS,
  allowedPlanItemStatuses,
  validatePlanItemStatusChange,
  validatePlanAdjustmentReason,
  getPlanItemProgressHint,
} = require('../src/services/projectStagePlanRules')

test('关键事项四态流转只开放已确认的目标', () => {
  const { NOT_STARTED, IN_PROGRESS, COMPLETED, PAUSED } = PLAN_ITEM_STATUS
  assert.equal(PLAN_ITEM_STATUS.CANCELLED, undefined)
  assert.deepEqual(allowedPlanItemStatuses(NOT_STARTED), [IN_PROGRESS, PAUSED])
  assert.deepEqual(allowedPlanItemStatuses(IN_PROGRESS), [COMPLETED, PAUSED])
  assert.deepEqual(allowedPlanItemStatuses(COMPLETED), [IN_PROGRESS])
  assert.deepEqual(allowedPlanItemStatuses(PAUSED, NOT_STARTED), [NOT_STARTED])
  assert.deepEqual(allowedPlanItemStatuses(PAUSED, IN_PROGRESS), [IN_PROGRESS])
})

test('状态变更校验完成信息和暂停原因', () => {
  const { COMPLETED, PAUSED, IN_PROGRESS } = PLAN_ITEM_STATUS
  assert.equal(validatePlanItemStatusChange(COMPLETED, {}, true, 0), '请填写实际完成时间')
  assert.equal(validatePlanItemStatusChange(COMPLETED, { actual_end_date: '2026-07-23' }, true, 0, '2026-07-23'), '请上传至少一个关键交付文件')
  assert.equal(validatePlanItemStatusChange(COMPLETED, { actual_end_date: '2026-02-30' }, false, 0, '2026-07-23'), '实际完成时间格式不正确，请使用YYYY-MM-DD')
  assert.equal(validatePlanItemStatusChange(COMPLETED, { actual_end_date: '2026-07-24' }, false, 0, '2026-07-23'), '实际完成时间不能晚于今天（2026-07-23）')
  assert.equal(validatePlanItemStatusChange(COMPLETED, { actual_end_date: '2026-07-23' }, true, 1, '2026-07-23'), null)
  assert.equal(validatePlanItemStatusChange(PAUSED, {}, false, 0), '请填写暂停原因')
  assert.equal(validatePlanItemStatusChange(PAUSED, { pause_reason: '等待客户确认' }, false, 0), null)
  assert.equal(validatePlanItemStatusChange(PAUSED, { pause_reason: '原'.repeat(201) }, false, 0), '暂停原因不能超过200个字符')
  assert.equal(validatePlanItemStatusChange(IN_PROGRESS, {}, false, 0), null)
})

test('计划调整原因必填且最多允许100个字符', () => {
  assert.equal(validatePlanAdjustmentReason(''), '请填写调整原因')
  assert.equal(validatePlanAdjustmentReason('原因'.repeat(50)), null)
  assert.equal(validatePlanAdjustmentReason('原'.repeat(101)), '调整原因不能超过100个字符')
})

test('自动进度提示只返回四种已确认结果', () => {
  const today = '2026-07-23'
  assert.equal(getPlanItemProgressHint({ status: 0, current_due_date: '2026-07-26' }, today), '临近截止')
  assert.equal(getPlanItemProgressHint({ status: 1, current_due_date: '2026-07-22' }, today), '已逾期 1 天')
  assert.equal(getPlanItemProgressHint({ status: 2, current_due_date: '2026-07-23', actual_end_date: '2026-07-23' }, today), '按期完成')
  assert.equal(getPlanItemProgressHint({ status: 2, current_due_date: '2026-07-22', actual_end_date: '2026-07-23' }, today), '延期完成')
  assert.equal(getPlanItemProgressHint({ status: 0, current_due_date: '2026-07-27' }, today), null)
  assert.equal(getPlanItemProgressHint({ status: 3, current_due_date: '2026-07-01' }, today), null)
})
