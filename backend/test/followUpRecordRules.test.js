const test = require('node:test')
const assert = require('node:assert/strict')

let rules = {}
try {
  rules = require('../src/services/followUpRecordRules')
} catch (error) {
  if (error?.code !== 'MODULE_NOT_FOUND') throw error
}

test('跟进内容去除首尾空格并拒绝空内容', () => {
  assert.equal(typeof rules.normalizeFollowUpContent, 'function')
  assert.equal(rules.normalizeFollowUpContent('  本周完成接口联调。\n  '), '本周完成接口联调。')
  assert.throws(() => rules.normalizeFollowUpContent('  \n  '), /请输入跟进内容/)
})

test('跟进内容最多允许 200 个字符', () => {
  assert.equal(typeof rules.normalizeFollowUpContent, 'function')
  assert.equal(rules.normalizeFollowUpContent('进'.repeat(200)).length, 200)
  assert.throws(() => rules.normalizeFollowUpContent('进'.repeat(201)), /跟进内容不能超过200字/)
})

test('跟进记录只允许关联项目、需求或任务中的一个对象', () => {
  assert.equal(typeof rules.resolveFollowUpTarget, 'function')
  assert.deepEqual(rules.resolveFollowUpTarget('project', '12'), {
    column: 'project_id',
    id: 12,
    module: '项目',
    table: 'pms_project',
  })
  assert.deepEqual(rules.resolveFollowUpTarget('requirement', 13), {
    column: 'requirement_id',
    id: 13,
    module: '需求',
    table: 'pms_requirement',
  })
  assert.deepEqual(rules.resolveFollowUpTarget('task', 14), {
    column: 'task_id',
    id: 14,
    module: '任务',
    table: 'pms_task',
  })
  assert.throws(() => rules.resolveFollowUpTarget('bug', 15), /跟进对象类型不正确/)
  assert.throws(() => rules.resolveFollowUpTarget('project', 'abc'), /跟进对象不存在/)
})

test('跟进操作写入所属业务对象的变更历史', () => {
  assert.equal(typeof rules.buildFollowUpHistoryLog, 'function')
  assert.deepEqual(
    rules.buildFollowUpHistoryLog(rules.resolveFollowUpTarget('project', 12), 'create', null, '开始联调'),
    {
      action: '新增跟进记录',
      fieldName: 'follow_up_content',
      module: '项目',
      newValue: '开始联调',
      oldValue: null,
      targetId: 12,
    }
  )
  assert.deepEqual(
    rules.buildFollowUpHistoryLog(rules.resolveFollowUpTarget('requirement', 13), 'update', '开始联调', '联调完成'),
    {
      action: '编辑跟进记录',
      fieldName: 'follow_up_content',
      module: '需求',
      newValue: '联调完成',
      oldValue: '开始联调',
      targetId: 13,
    }
  )
  assert.deepEqual(
    rules.buildFollowUpHistoryLog(rules.resolveFollowUpTarget('task', 14), 'remove', '联调完成', null),
    {
      action: '删除跟进记录',
      fieldName: 'follow_up_content',
      module: '任务',
      newValue: null,
      oldValue: '联调完成',
      targetId: 14,
    }
  )
  assert.throws(
    () => rules.buildFollowUpHistoryLog(rules.resolveFollowUpTarget('project', 12), 'publish', null, null),
    /跟进操作类型不正确/
  )
})

test('既有跟进历史动作统一展示为跟进记录', () => {
  assert.equal(typeof rules.normalizeFollowUpHistoryAction, 'function')
  assert.equal(rules.normalizeFollowUpHistoryAction('新增跟进'), '新增跟进记录')
  assert.equal(rules.normalizeFollowUpHistoryAction('编辑跟进'), '编辑跟进记录')
  assert.equal(rules.normalizeFollowUpHistoryAction('删除跟进'), '删除跟进记录')
  assert.equal(rules.normalizeFollowUpHistoryAction('状态变更'), '状态变更')
})
