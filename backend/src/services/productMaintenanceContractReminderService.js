const cron = require('node-cron')
const db = require('../db')
const { getShanghaiDateText } = require('../utils/date')
const { resolveReminderOccurrence } = require('./productMaintenanceContractRules')
const { executeOnce } = require('./scheduledTaskExecutionService')

function reminderDescription(contract, occurrence) {
  if (occurrence.daysUntilExpiry > 0) {
    return `产品“${contract.product_name}”的运维合同“${contract.contract_name}”将在${occurrence.daysUntilExpiry}天后到期，到期日为${contract.service_end_date}。请及时办理续签。`
  }
  if (occurrence.daysUntilExpiry === 0) {
    return `产品“${contract.product_name}”的运维合同“${contract.contract_name}”于今天到期。请及时办理续签。`
  }
  return `产品“${contract.product_name}”的运维合同“${contract.contract_name}”已逾期${occurrence.overdueDays}天。请及时办理续签或终止合同。`
}

async function sendMaintenanceContractReminders(todayText = getShanghaiDateText(), database = db) {
  const contracts = await database.prepare(`SELECT contract.id, contract.product_id, contract.contract_name,
      contract.service_end_date, contract.termination_date, product.name product_name, product.owner_id,
      EXISTS (SELECT 1 FROM pms_product_maintenance_contract successor
        WHERE successor.previous_contract_id = contract.id AND successor.is_deleted = 0) has_successor
    FROM pms_product_maintenance_contract contract
    JOIN pms_product product ON product.id = contract.product_id AND product.is_deleted = 0
    WHERE contract.is_deleted = 0 AND contract.termination_date IS NULL`).all()
  let sent = 0
  for (const contract of contracts) {
    const occurrence = resolveReminderOccurrence(contract, todayText)
    if (!occurrence) continue
    const outcome = await executeOnce({
      taskCode: 'product_maintenance_contract_reminder',
      targetType: 'product_maintenance_contract',
      targetId: contract.id,
      executionKey: occurrence.key,
    }, async () => {
      const result = await database.prepare(`INSERT INTO pms_message
        (recipient_user_id, type, title, description, link_path)
        VALUES (?, 'notification', ?, ?, ?)`).run(
        contract.owner_id,
        '运维合同到期提醒',
        reminderDescription(contract, occurrence),
        `/products/${contract.product_id}/maintenance-contracts/${contract.id}`
      )
      return { messageId: result.lastInsertRowid, recipientUserId: contract.owner_id }
    }, database)
    if (outcome.executed) sent += 1
  }
  return { checked: contracts.length, sent, checkedAt: todayText }
}

function start() {
  cron.schedule('30 8 * * *', async () => {
    try {
      const result = await sendMaintenanceContractReminders()
      if (result.sent > 0) console.log(`[Cron] 运维合同到期提醒：发送 ${result.sent} 条`)
    } catch (error) {
      console.error('[Cron] 运维合同到期提醒执行失败:', error)
    }
  }, { timezone: 'Asia/Shanghai' })
  console.log('[Cron] 运维合同到期提醒任务已启动（每天 08:30 执行）')
}

module.exports = { reminderDescription, sendMaintenanceContractReminders, start }
