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

module.exports = {
  calculatePaymentSummary,
  normalizePaymentMonth,
  toCents,
  validateContractStages,
  validatePaymentAmount,
}
