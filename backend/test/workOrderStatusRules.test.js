const assert = require('node:assert/strict')
const test = require('node:test')

let rules = {}
try {
  rules = require('../src/services/workOrderStatusRules')
} catch {}

test('工单可以从任一状态暂停且暂停后可流转到任一其他状态', () => {
  assert.equal(typeof rules.allowedWorkOrderStatuses, 'function')
  assert.deepEqual(rules.allowedWorkOrderStatuses(0), [1, 4])
  assert.deepEqual(rules.allowedWorkOrderStatuses(1), [2, 4])
  assert.deepEqual(rules.allowedWorkOrderStatuses(2), [3, 4])
  assert.deepEqual(rules.allowedWorkOrderStatuses(3), [4])
  assert.deepEqual(rules.allowedWorkOrderStatuses(4), [0, 1, 2, 3])
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
