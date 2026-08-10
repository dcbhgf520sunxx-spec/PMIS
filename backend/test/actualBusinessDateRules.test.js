const test = require('node:test')
const assert = require('node:assert/strict')
const { validateActualBusinessDate } = require('../src/services/actualBusinessDateRules')

test('实际业务日期必须是真实的YYYY-MM-DD且不得晚于上海当天', () => {
  assert.equal(validateActualBusinessDate('', '实际完成时间', '2026-08-10'), null)
  assert.equal(validateActualBusinessDate('2026-08-10', '实际完成时间', '2026-08-10'), null)
  assert.equal(validateActualBusinessDate('2026-02-29', '实际完成时间', '2026-08-10'), '实际完成时间格式不正确，请使用YYYY-MM-DD')
  assert.equal(validateActualBusinessDate('2026/08/10', '实际完成时间', '2026-08-10'), '实际完成时间格式不正确，请使用YYYY-MM-DD')
  assert.equal(validateActualBusinessDate('2026-08-11', '实际完成时间', '2026-08-10'), '实际完成时间不能晚于今天（2026-08-10）')
})
