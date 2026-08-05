const DAY_MS = 24 * 60 * 60 * 1000
const BEFORE_EXPIRY_DAYS = new Set([30, 15, 7, 3, 2, 1])

function formatContractAmount(value) {
  const text = String(value ?? '').trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return text
  const [whole, fraction = ''] = text.split('.')
  return `${whole}.${fraction.padEnd(2, '0')}`
}

function formatMaintenanceContractTargetValue(value) {
  return String(value || '').split('｜', 1)[0].trim()
}

function validateImmutableContractCode(currentCode, submittedCode) {
  return String(currentCode || '').trim() === String(submittedCode || '').trim()
    ? null
    : '合同编号不允许修改'
}

function buildMaintenanceContractHistoryChanges({ oldContract, newContract, newSupplierName }) {
  const changes = [{
    field: 'maintenance_contract_target',
    oldVal: '',
    newVal: oldContract.contract_code.trim(),
  }]
  const addChange = (field, oldVal, newVal, oldCompare = oldVal, newCompare = newVal) => {
    if (String(oldCompare ?? '') !== String(newCompare ?? '')) changes.push({ field, oldVal, newVal })
  }

  addChange('maintenance_contract_name', oldContract.contract_name.trim(), newContract.contract_name.trim())
  addChange(
    'maintenance_contract_supplier',
    oldContract.supplier_name,
    newSupplierName,
    oldContract.supplier_id,
    newContract.supplier_id
  )
  addChange('maintenance_contract_signed_date', oldContract.signed_date, newContract.signed_date)
  addChange('maintenance_contract_service_start_date', oldContract.service_start_date, newContract.service_start_date)
  addChange('maintenance_contract_service_end_date', oldContract.service_end_date, newContract.service_end_date)
  addChange('maintenance_contract_amount', formatContractAmount(oldContract.contract_amount), formatContractAmount(newContract.contract_amount))
  addChange('maintenance_contract_remark', oldContract.remark || '', newContract.remark || '')
  return changes
}

function buildMaintenanceContractTerminationHistoryChanges({ contractCode, terminationDate, terminationReason }) {
  return [
    { field: 'maintenance_contract_target', oldVal: '', newVal: contractCode.trim() },
    { field: 'maintenance_contract_termination_date', oldVal: '', newVal: terminationDate },
    { field: 'maintenance_contract_termination_reason', oldVal: '', newVal: String(terminationReason || '').trim() },
  ]
}

function parseDate(value) {
  const text = String(value || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const date = new Date(`${text}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? null : date
}

function isValidDateText(value) {
  return Boolean(parseDate(value))
}

function diffDays(later, earlier) {
  return Math.round((later.getTime() - earlier.getTime()) / DAY_MS)
}

function deriveContractStatus(contract, todayText) {
  if (contract.terminationDate || contract.termination_date) return 'terminated'
  if (contract.hasSuccessor || contract.has_successor) return 'renewed'
  const today = parseDate(todayText)
  const start = parseDate(contract.serviceStartDate || contract.service_start_date)
  const end = parseDate(contract.serviceEndDate || contract.service_end_date)
  if (!today || !start || !end) return 'unknown'
  if (today < start) return 'pending'
  if (today > end) return 'expired'
  return 'active'
}

function validateContractDates({
  serviceStartDate,
  serviceEndDate,
  previousServiceEndDate,
  nextServiceStartDate,
  terminationDate,
  terminationReason,
}) {
  const start = parseDate(serviceStartDate)
  const end = parseDate(serviceEndDate)
  if (!start) return '请选择有效的服务开始日期'
  if (!end) return '请选择有效的服务结束日期'
  if (end < start) return '服务结束日期不能早于服务开始日期'
  const previousEnd = parseDate(previousServiceEndDate)
  if (previousEnd && start <= previousEnd) return '服务开始日期必须晚于上一份合同的服务结束日期'
  const nextStart = parseDate(nextServiceStartDate)
  if (nextStart && end >= nextStart) return '服务结束日期必须早于下一份合同的服务开始日期'
  if (terminationDate && !String(terminationReason || '').trim()) return '请填写终止原因'
  if (!terminationDate && String(terminationReason || '').trim()) return '请选择终止日期'
  const termination = parseDate(terminationDate)
  if (terminationDate && !termination) return '请选择有效的终止日期'
  if (termination && termination < start) return '终止日期不能早于服务开始日期'
  if (termination && termination > end) return '终止日期不能晚于服务结束日期'
  return null
}

function validateContractAttachmentCount(count) {
  return Number(count) >= 1 ? null : '请至少上传1个合同附件'
}

function resolveReminderOccurrence(contract, todayText) {
  if (contract.terminationDate || contract.termination_date || contract.hasSuccessor || contract.has_successor) return null
  const today = parseDate(todayText)
  const endText = contract.serviceEndDate || contract.service_end_date
  const end = parseDate(endText)
  if (!today || !end) return null
  const daysUntilExpiry = diffDays(end, today)
  if (BEFORE_EXPIRY_DAYS.has(daysUntilExpiry)) {
    return { key: `before:${daysUntilExpiry}:${endText}`, daysUntilExpiry }
  }
  if (daysUntilExpiry === 0) return { key: `expiry:${endText}`, daysUntilExpiry: 0 }
  const overdueDays = -daysUntilExpiry
  if (overdueDays > 0 && overdueDays % 7 === 0) return { key: `overdue:${overdueDays}:${endText}`, overdueDays }
  return null
}

module.exports = {
  buildMaintenanceContractHistoryChanges,
  buildMaintenanceContractTerminationHistoryChanges,
  deriveContractStatus,
  formatMaintenanceContractTargetValue,
  isValidDateText,
  resolveReminderOccurrence,
  validateContractAttachmentCount,
  validateImmutableContractCode,
  validateContractDates,
}
