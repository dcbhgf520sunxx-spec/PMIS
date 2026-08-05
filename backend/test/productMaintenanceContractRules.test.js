const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildMaintenanceContractHistoryChanges,
  buildMaintenanceContractTerminationHistoryChanges,
  deriveContractStatus,
  formatMaintenanceContractTargetValue,
  isValidDateText,
  resolveReminderOccurrence,
  validateContractAttachmentCount,
  validateImmutableContractCode,
  validateContractDates,
} = require('../src/services/productMaintenanceContractRules')

test('编辑运维合同只记录真实变化并使用可读业务值', () => {
  const changes = buildMaintenanceContractHistoryChanges({
    oldContract: {
      contract_code: 'MC-001', contract_name: '旧合同', supplier_id: 1, supplier_name: '旧供应商',
      signed_date: '2026-01-01', service_start_date: '2026-02-01', service_end_date: '2026-12-31',
      contract_amount: '1000.00', remark: null,
    },
    newContract: {
      contract_code: 'MC-002', contract_name: '新合同', supplier_id: '2', signed_date: '2026-01-02',
      service_start_date: '2026-02-01', service_end_date: '2027-01-31', contract_amount: '1200', remark: '续签调整',
    },
    newSupplierName: '新供应商',
  })

  assert.deepEqual(changes, [
    { field: 'maintenance_contract_target', oldVal: '', newVal: 'MC-001' },
    { field: 'maintenance_contract_name', oldVal: '旧合同', newVal: '新合同' },
    { field: 'maintenance_contract_supplier', oldVal: '旧供应商', newVal: '新供应商' },
    { field: 'maintenance_contract_signed_date', oldVal: '2026-01-01', newVal: '2026-01-02' },
    { field: 'maintenance_contract_service_end_date', oldVal: '2026-12-31', newVal: '2027-01-31' },
    { field: 'maintenance_contract_amount', oldVal: '1000.00', newVal: '1200.00' },
    { field: 'maintenance_contract_remark', oldVal: '', newVal: '续签调整' },
  ])
})

test('终止运维合同记录终止时间和终止原因', () => {
  assert.deepEqual(buildMaintenanceContractTerminationHistoryChanges({
    contractCode: 'MC-001',
    contractName: '年度运维合同',
    terminationDate: '2026-08-05',
    terminationReason: '供应商停止服务',
  }), [
    { field: 'maintenance_contract_target', oldVal: '', newVal: 'MC-001' },
    { field: 'maintenance_contract_termination_date', oldVal: '', newVal: '2026-08-05' },
    { field: 'maintenance_contract_termination_reason', oldVal: '', newVal: '供应商停止服务' },
  ])
})

test('运维合同历史上下文兼容旧日志并只展示合同号', () => {
  assert.equal(formatMaintenanceContractTargetValue('MC-001｜年度运维合同'), 'MC-001')
  assert.equal(formatMaintenanceContractTargetValue('MC-002'), 'MC-002')
})

test('编辑运维合同时拒绝修改合同号', () => {
  assert.equal(validateImmutableContractCode('MC-001', 'MC-001'), null)
  assert.equal(validateImmutableContractCode('MC-001', 'MC-002'), '合同编号不允许修改')
})

test('运维合同必须至少保留一个附件', () => {
  assert.equal(validateContractAttachmentCount(0), '请至少上传1个合同附件')
  assert.equal(validateContractAttachmentCount(1), null)
  assert.equal(validateContractAttachmentCount(10), null)
})

test('日期校验拒绝日历中不存在的日期', () => {
  assert.equal(isValidDateText('2026-02-28'), true)
  assert.equal(isValidDateText('2026-02-30'), false)
})

test('运维合同状态按终止、续签和服务日期推导', () => {
  assert.equal(deriveContractStatus({ serviceStartDate: '2026-09-01', serviceEndDate: '2027-08-31' }, '2026-08-04'), 'pending')
  assert.equal(deriveContractStatus({ serviceStartDate: '2026-01-01', serviceEndDate: '2026-12-31' }, '2026-08-04'), 'active')
  assert.equal(deriveContractStatus({ serviceStartDate: '2025-01-01', serviceEndDate: '2025-12-31' }, '2026-08-04'), 'expired')
  assert.equal(deriveContractStatus({ serviceStartDate: '2025-01-01', serviceEndDate: '2025-12-31', hasSuccessor: true }, '2026-08-04'), 'renewed')
  assert.equal(deriveContractStatus({ serviceStartDate: '2025-01-01', serviceEndDate: '2025-12-31', hasSuccessor: true, terminationDate: '2025-06-01' }, '2026-08-04'), 'terminated')
})

test('运维合同允许空档但拒绝前后合同日期重叠', () => {
  assert.equal(validateContractDates({
    serviceStartDate: '2026-02-01',
    serviceEndDate: '2026-12-31',
    previousServiceEndDate: '2026-01-15',
  }), null)
  assert.equal(validateContractDates({
    serviceStartDate: '2026-01-15',
    serviceEndDate: '2026-12-31',
    previousServiceEndDate: '2026-01-15',
  }), '服务开始日期必须晚于上一份合同的服务结束日期')
  assert.equal(validateContractDates({
    serviceStartDate: '2026-02-01',
    serviceEndDate: '2027-02-01',
    nextServiceStartDate: '2027-02-01',
  }), '服务结束日期必须早于下一份合同的服务开始日期')
})

test('运维合同拒绝倒置日期和不完整的终止信息', () => {
  assert.equal(validateContractDates({ serviceStartDate: '2026-12-31', serviceEndDate: '2026-01-01' }), '服务结束日期不能早于服务开始日期')
  assert.equal(validateContractDates({ serviceStartDate: '2026-01-01', serviceEndDate: '2026-12-31', terminationDate: '2026-06-01' }), '请填写终止原因')
  assert.equal(validateContractDates({ serviceStartDate: '2026-01-01', serviceEndDate: '2026-12-31', terminationReason: '供应商违约' }), '请选择终止日期')
  assert.equal(validateContractDates({ serviceStartDate: '2026-01-01', serviceEndDate: '2026-12-31', terminationDate: '2027-01-01', terminationReason: '供应商违约' }), '终止日期不能晚于服务结束日期')
  assert.equal(validateContractDates({ serviceStartDate: '2026-01-01', serviceEndDate: '2026-12-31', terminationDate: '2025-12-31', terminationReason: '供应商违约' }), '终止日期不能早于服务开始日期')
})

test('运维合同在固定节点提醒并在续签或终止后停止', () => {
  const contract = { id: 9, serviceEndDate: '2026-09-03', ownerId: 12 }
  assert.deepEqual(resolveReminderOccurrence(contract, '2026-08-04'), { key: 'before:30:2026-09-03', daysUntilExpiry: 30 })
  assert.deepEqual(resolveReminderOccurrence(contract, '2026-08-31'), { key: 'before:3:2026-09-03', daysUntilExpiry: 3 })
  assert.deepEqual(resolveReminderOccurrence(contract, '2026-09-03'), { key: 'expiry:2026-09-03', daysUntilExpiry: 0 })
  assert.deepEqual(resolveReminderOccurrence({ ...contract, serviceEndDate: '2026-07-21' }, '2026-08-04'), { key: 'overdue:14:2026-07-21', overdueDays: 14 })
  assert.equal(resolveReminderOccurrence({ ...contract, serviceEndDate: '2026-07-22' }, '2026-08-04'), null)
  assert.equal(resolveReminderOccurrence({ ...contract, hasSuccessor: true }, '2026-08-04'), null)
  assert.equal(resolveReminderOccurrence({ ...contract, terminationDate: '2026-07-01' }, '2026-08-04'), null)
})

test('定时任务执行键稳定区分任务、业务对象和触发节点', () => {
  const occurrence = resolveReminderOccurrence({ id: 9, serviceEndDate: '2026-09-03', ownerId: 12 }, '2026-08-04')
  assert.equal(occurrence.key, 'before:30:2026-09-03')
  assert.notEqual(occurrence.key, resolveReminderOccurrence({ id: 9, serviceEndDate: '2026-09-04', ownerId: 12 }, '2026-08-05').key)
})
