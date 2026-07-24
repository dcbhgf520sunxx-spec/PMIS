const assert = require('node:assert/strict')
const test = require('node:test')

let rules = {}
try {
  rules = require('../src/services/workOrderStatusRules')
} catch {}

test('工单新增被激活状态且保持原有状态流转', () => {
  assert.equal(typeof rules.allowedWorkOrderStatuses, 'function')
  assert.deepEqual(rules.allowedWorkOrderStatuses(0), [1, 4])
  assert.deepEqual(rules.allowedWorkOrderStatuses(1), [2, 4])
  assert.deepEqual(rules.allowedWorkOrderStatuses(2), [3, 4, 5])
  assert.deepEqual(rules.allowedWorkOrderStatuses(3), [4, 5])
  assert.deepEqual(rules.allowedWorkOrderStatuses(4), [0, 1, 2, 3])
  assert.deepEqual(rules.allowedWorkOrderStatuses(5), [2])
})

test('进入暂停保留已有结果字段并记录暂停时间，恢复后清空暂停时间', () => {
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
      closeDate: null,
      resultDesc: null,
      suspendDate: null
    })
  }
})

test('暂停后直接关闭必须重新提供修复时间、关闭时间和处置结果', () => {
  assert.equal(typeof rules.resolveWorkOrderResultFields, 'function')
  const values = rules.resolveWorkOrderResultFields(3, {
    resolve_date: '2026-07-18',
    close_date: '2026-07-19',
    result_desc: '重新处理完成'
  }, {})
  assert.deepEqual(values, {
    resolveDate: '2026-07-18',
    closeDate: '2026-07-19',
    resultDesc: '重新处理完成',
    suspendDate: null
  })
  assert.equal(rules.validateWorkOrderResultFields(3, values), '')
  assert.match(rules.validateWorkOrderResultFields(3, { closeDate: '2026-07-19' }), /实际修复时间和处置结果/)
})

test('已解决工单正常关闭时复用已有修复时间和处置结果', () => {
  const values = rules.resolveWorkOrderResultFields(3, { close_date: '2026-07-19' }, {
    resolve_date: '2026-07-18',
    result_desc: '处理完成'
  })
  assert.deepEqual(values, {
    resolveDate: '2026-07-18',
    closeDate: '2026-07-19',
    resultDesc: '处理完成',
    suspendDate: null
  })
  assert.equal(rules.validateWorkOrderResultFields(3, values), '')
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
    closeDate: null,
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
