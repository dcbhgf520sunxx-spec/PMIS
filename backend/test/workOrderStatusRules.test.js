const assert = require('node:assert/strict')
const test = require('node:test')

let rules = {}
try {
  rules = require('../src/services/workOrderStatusRules')
} catch {}

test('工单取消已关闭并允许待处理直接解决', () => {
  assert.equal(typeof rules.allowedWorkOrderStatuses, 'function')
  assert.deepEqual(rules.allowedWorkOrderStatuses(0), [1, 2, 4])
  assert.deepEqual(rules.allowedWorkOrderStatuses(1), [2, 4])
  assert.deepEqual(rules.allowedWorkOrderStatuses(2), [4, 5])
  assert.deepEqual(rules.allowedWorkOrderStatuses(3), [])
  assert.deepEqual(rules.allowedWorkOrderStatuses(4), [0, 1, 2])
  assert.deepEqual(rules.allowedWorkOrderStatuses(5), [2])
})

test('进入暂停保留已有结果和历史关闭时间，恢复后只清理现行处理字段', () => {
  assert.equal(typeof rules.resolveWorkOrderResultFields, 'function')
  const old = { resolve_date: '2026-07-16', close_date: '2026-07-17', result_desc: '旧结果' }
  assert.deepEqual(rules.resolveWorkOrderResultFields(4, { suspend_date: '2026-07-18' }, old), {
    resolveDate: '2026-07-16',
    closeDate: '2026-07-17',
    resultDesc: '旧结果',
    suspendDate: '2026-07-18'
  })
  assert.match(rules.validateWorkOrderResultFields(4, {}), /暂停时间/)
  for (const status of [0, 1]) {
    assert.deepEqual(rules.resolveWorkOrderResultFields(status, {}, old), {
      resolveDate: null,
      closeDate: '2026-07-17',
      resultDesc: null,
      suspendDate: null
    })
  }
})

test('解决工单保留历史关闭时间并要求新的修复信息', () => {
  const values = rules.resolveWorkOrderResultFields(2, {
    resolve_date: '2026-07-20',
    result_desc: '重新处理完成'
  }, {
    resolve_date: '2026-07-18',
    close_date: '2026-07-19',
    result_desc: '原处理结果'
  })
  assert.deepEqual(values, {
    resolveDate: '2026-07-20',
    closeDate: '2026-07-19',
    resultDesc: '重新处理完成',
    suspendDate: null
  })
  assert.equal(rules.validateWorkOrderResultFields(2, values, '2026-07-20'), '')
  assert.equal(rules.validateWorkOrderResultFields(2, { ...values, resolveDate: '2026-07-21' }, '2026-07-20'), '实际修复时间不能晚于今天（2026-07-20）')
})

test('激活工单只必填激活原因并沿用原预计完成时间', () => {
  assert.equal(typeof rules.resolveWorkOrderResultFields, 'function')
  const old = {
    expected_resolve_date: '2026-07-20',
    resolve_date: '2026-07-20',
    close_date: '2026-07-21',
    result_desc: '上次处置结果',
    suspend_date: null
  }
  const missingReason = rules.resolveWorkOrderResultFields(5, {}, old)
  assert.match(rules.validateWorkOrderResultFields(5, missingReason), /激活原因/)

  const values = rules.resolveWorkOrderResultFields(5, {
    activation_reason: ' 问题再次出现 ',
    expected_resolve_date: '2020-01-01'
  }, old)
  assert.deepEqual(values, {
    resolveDate: '2026-07-20',
    closeDate: '2026-07-21',
    resultDesc: '上次处置结果',
    suspendDate: null,
    activationReason: '问题再次出现'
  })
  assert.equal(rules.validateWorkOrderResultFields(5, values), '')
  assert.equal('expectedResolveDate' in values, false)
})

test('工单激活原因最多100字', () => {
  const values = rules.resolveWorkOrderResultFields(5, {
    activation_reason: 'a'.repeat(101)
  }, {})
  assert.match(rules.validateWorkOrderResultFields(5, values), /不能超过100字/)
})

test('工单进入待处理或处理中时清空激活原因，其他状态保留本轮激活原因', () => {
  assert.equal(typeof rules.resolveWorkOrderActivationReason, 'function')
  const old = { activation_reason: '问题再次出现' }

  assert.equal(rules.resolveWorkOrderActivationReason(0, {}, old), null)
  assert.equal(rules.resolveWorkOrderActivationReason(1, {}, old), null)
  assert.equal(rules.resolveWorkOrderActivationReason(2, {}, old), '问题再次出现')
  assert.equal(rules.resolveWorkOrderActivationReason(3, {}, old), '问题再次出现')
  assert.equal(rules.resolveWorkOrderActivationReason(4, {}, old), '问题再次出现')
  assert.equal(
    rules.resolveWorkOrderActivationReason(5, { activation_reason: ' 新的激活原因 ' }, old),
    '新的激活原因'
  )
})
