const test = require('node:test')
const assert = require('node:assert/strict')

const {
  calculatePaymentSummary,
  validateContractStages,
  validatePaymentAmount,
  normalizePaymentMonth,
} = require('../src/services/projectContractRules')

test('付款汇总区分未付款、部分付款和已付清', () => {
  assert.deepEqual(calculatePaymentSummary('100.00', []), {
    plannedAmount: 100,
    paidAmount: 0,
    unpaidAmount: 100,
    paymentStatus: 0,
  })
  assert.deepEqual(calculatePaymentSummary('100.00', ['20.10', '29.90']), {
    plannedAmount: 100,
    paidAmount: 50,
    unpaidAmount: 50,
    paymentStatus: 1,
  })
  assert.deepEqual(calculatePaymentSummary('100.00', ['40.00', '60.00']), {
    plannedAmount: 100,
    paidAmount: 100,
    unpaidAmount: 0,
    paymentStatus: 2,
  })
})

test('合同阶段金额合计必须等于合同金额且阶段名称不能重复', () => {
  assert.equal(validateContractStages('100.00', [
    { stage_name: '签约款', planned_amount: '30.00' },
    { stage_name: '验收款', planned_amount: '70.00' },
  ]), null)
  assert.equal(validateContractStages('100.00', [
    { stage_name: '签约款', planned_amount: '30.00' },
    { stage_name: '验收款', planned_amount: '60.00' },
  ]), '付款阶段计划金额合计必须等于合同金额')
  assert.equal(validateContractStages('100.00', [
    { stage_name: '签约款', planned_amount: '50.00' },
    { stage_name: '签约款', planned_amount: '50.00' },
  ]), '同一合同内付款阶段名称不能重复')
})

test('本次付款金额必须为正数且不能超过阶段待付金额', () => {
  assert.equal(validatePaymentAmount('0', '100.00'), '本次付款金额必须大于0')
  assert.equal(validatePaymentAmount('100.01', '100.00'), '本次付款金额不能超过该阶段待付金额')
  assert.equal(validatePaymentAmount('100.00', '100.00'), null)
})

test('付款月份统一保存为当月第一天且不能晚于当前月份', () => {
  assert.equal(normalizePaymentMonth('2026-07', '2026-07-20'), '2026-07-01')
  assert.equal(normalizePaymentMonth('2026-08', '2026-07-20'), null)
  assert.equal(normalizePaymentMonth('2026-7', '2026-07-20'), null)
})
