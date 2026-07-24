function toCents(value) {
  const text = String(value ?? '').trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null
  const [whole, fraction = ''] = text.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

function fromCents(value) {
  return Number(value) / 100
}

function calculatePaymentSummary(plannedAmount, paymentAmounts) {
  const planned = toCents(plannedAmount) ?? 0n
  const paid = paymentAmounts.reduce((total, amount) => total + (toCents(amount) ?? 0n), 0n)
  const unpaid = planned > paid ? planned - paid : 0n
  return {
    plannedAmount: fromCents(planned),
    paidAmount: fromCents(paid),
    unpaidAmount: fromCents(unpaid),
    paymentStatus: paid === 0n ? 0 : paid < planned ? 1 : 2,
  }
}

function validateContractStages(contractAmount, stages) {
  const contract = toCents(contractAmount)
  if (contract === null || contract <= 0n) return '合同金额必须大于0'
  if (!Array.isArray(stages) || stages.length === 0) return '请至少添加一个付款阶段'
  const names = new Set()
  let total = 0n
  for (const stage of stages) {
    const name = String(stage?.stage_name || '').trim()
    if (!name) return '请填写付款阶段'
    if (names.has(name)) return '同一合同内付款阶段名称不能重复'
    names.add(name)
    const amount = toCents(stage?.planned_amount)
    if (amount === null || amount <= 0n) return '付款阶段计划金额必须大于0'
    total += amount
  }
  return total === contract ? null : '付款阶段计划金额合计必须等于合同金额'
}

function validatePaymentAmount(paymentAmount, unpaidAmount) {
  const payment = toCents(paymentAmount)
  const unpaid = toCents(unpaidAmount)
  if (payment === null || payment <= 0n) return '本次付款金额必须大于0'
  if (unpaid === null || payment > unpaid) return '本次付款金额不能超过该阶段待付金额'
  return null
}

function normalizePaymentMonth(value, today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })) {
  const text = String(value || '')
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) return null
  if (text > String(today).slice(0, 7)) return null
  return `${text}-01`
}

function formatMoney(value) {
  const cents = toCents(value)
  if (cents === null) return String(value ?? '')
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}

function formatContractStages(stages) {
  return (stages || [])
    .map((stage) => `${String(stage.stage_name || '').trim()}：${formatMoney(stage.planned_amount)}`)
    .join('；')
}

function buildContractHistoryChanges({ oldContract, oldStages, newContract, newSupplierName }) {
  const changes = []
  const addChange = (field, oldVal, newVal, oldCompare = oldVal, newCompare = newVal) => {
    if (String(oldCompare ?? '') !== String(newCompare ?? '')) changes.push({ field, oldVal, newVal })
  }

  addChange('contract_code', oldContract.contract_code.trim(), newContract.contract_code.trim())
  addChange('contract_name', oldContract.contract_name.trim(), newContract.contract_name.trim())
  addChange(
    'contract_supplier',
    oldContract.supplier_name,
    newSupplierName,
    oldContract.supplier_id,
    newContract.supplier_id
  )
  addChange('contract_signed_date', oldContract.signed_date, newContract.signed_date)
  addChange('contract_amount', formatMoney(oldContract.contract_amount), formatMoney(newContract.contract_amount))
  addChange('contract_remark', oldContract.remark || '', newContract.remark || '')
  addChange('contract_stages', formatContractStages(oldStages), formatContractStages(newContract.stages))
  return changes
}

module.exports = {
  buildContractHistoryChanges,
  calculatePaymentSummary,
  normalizePaymentMonth,
  toCents,
  validateContractStages,
  validatePaymentAmount,
}
