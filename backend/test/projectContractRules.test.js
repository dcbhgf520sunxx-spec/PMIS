const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildContractHistoryChanges,
  buildPaymentCreationHistoryChanges,
  buildPaymentHistoryChanges,
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

test('编辑合同只为实际修改字段逐行生成历史明细', () => {
  const changes = buildContractHistoryChanges({
    oldContract: {
      contract_code: 'HT-001',
      contract_name: '原合同',
      supplier_id: 10,
      supplier_name: '原供应商',
      signed_date: '2026-07-01',
      contract_amount: '200000.00',
      remark: '原备注',
    },
    oldStages: [
      { stage_name: '首付款', planned_amount: '100000.00' },
      { stage_name: '验收款', planned_amount: '100000.00' },
    ],
    newContract: {
      contract_code: ' HT-001 ',
      contract_name: '新合同',
      supplier_id: 11,
      signed_date: '2026-07-02',
      contract_amount: '120000',
      remark: '新备注',
      stages: [
        { stage_name: '首付款', planned_amount: '60000.00' },
        { stage_name: '验收款', planned_amount: '60000.00' },
      ],
    },
    newSupplierName: '新供应商',
  })

  assert.deepEqual(changes, [
    { field: 'contract_name', oldVal: '原合同', newVal: '新合同' },
    { field: 'contract_supplier', oldVal: '原供应商', newVal: '新供应商' },
    { field: 'contract_signed_date', oldVal: '2026-07-01', newVal: '2026-07-02' },
    { field: 'contract_amount', oldVal: '200000.00', newVal: '120000.00' },
    { field: 'contract_remark', oldVal: '原备注', newVal: '新备注' },
    {
      field: 'contract_stages',
      oldVal: '首付款：100000.00；验收款：100000.00',
      newVal: '首付款：60000.00；验收款：60000.00',
    },
  ])
})

test('编辑合同忽略格式差异和未修改字段', () => {
  const changes = buildContractHistoryChanges({
    oldContract: {
      contract_code: 'HT-001',
      contract_name: '合同',
      supplier_id: 10,
      supplier_name: '供应商',
      signed_date: '2026-07-01',
      contract_amount: '200000.00',
      remark: null,
    },
    oldStages: [{ stage_name: '验收款', planned_amount: '200000.00' }],
    newContract: {
      contract_code: ' HT-001 ',
      contract_name: '合同',
      supplier_id: 10,
      signed_date: '2026-07-01',
      contract_amount: '200000',
      remark: '',
      stages: [{ stage_name: '验收款', planned_amount: 200000 }],
    },
    newSupplierName: '供应商',
  })

  assert.deepEqual(changes, [])
})

test('更正付款只记录实际修改字段并使用业务展示值', () => {
  const changes = buildPaymentHistoryChanges({
    stageName: '阶段一',
    oldPayment: {
      payment_amount: '30000.00',
      payment_month: '2026-07-01',
      handler_id: 1,
      handler_name: '原经办人',
      remark: '原备注',
    },
    newPayment: {
      payment_amount: '3000',
      payment_month: '2026-06-01',
      handler_id: 2,
      handler_name: '新经办人',
      remark: '新备注',
    },
  })

  assert.deepEqual(changes, [
    { field: 'payment_stage', oldVal: '', newVal: '阶段一' },
    { field: 'payment_amount', oldVal: '30000.00', newVal: '3000.00' },
    { field: 'payment_month', oldVal: '2026-07', newVal: '2026-06' },
    { field: 'payment_handler', oldVal: '原经办人', newVal: '新经办人' },
    { field: 'payment_remark', oldVal: '原备注', newVal: '新备注' },
  ])
})

test('更正付款忽略金额格式差异和未修改字段', () => {
  const changes = buildPaymentHistoryChanges({
    stageName: '阶段一',
    oldPayment: {
      payment_amount: '3000.00',
      payment_month: '2026-07-01',
      handler_id: 1,
      handler_name: '经办人',
      remark: null,
    },
    newPayment: {
      payment_amount: '3000',
      payment_month: '2026-07-01',
      handler_id: 1,
      handler_name: '经办人',
      remark: '',
    },
  })

  assert.deepEqual(changes, [])
})

test('登记付款按字段记录付款阶段和业务值', () => {
  const changes = buildPaymentCreationHistoryChanges({
    stageName: '阶段一',
    payment: {
      payment_amount: '26999',
      payment_month: '2026-05-01',
      handler_name: '孙鑫鑫',
      remark: '首期付款',
    },
  })

  assert.deepEqual(changes, [
    { field: 'payment_stage', oldVal: '', newVal: '阶段一' },
    { field: 'payment_amount', oldVal: '', newVal: '26999.00' },
    { field: 'payment_month', oldVal: '', newVal: '2026-05' },
    { field: 'payment_handler', oldVal: '', newVal: '孙鑫鑫' },
    { field: 'payment_remark', oldVal: '', newVal: '首期付款' },
  ])
})

test('登记付款未填写备注时不生成空备注明细', () => {
  const changes = buildPaymentCreationHistoryChanges({
    stageName: '阶段一',
    payment: {
      payment_amount: '26999',
      payment_month: '2026-05-01',
      handler_name: '孙鑫鑫',
      remark: '',
    },
  })

  assert.equal(changes.some((change) => change.field === 'payment_remark'), false)
})
