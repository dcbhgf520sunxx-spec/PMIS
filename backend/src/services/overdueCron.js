const cron = require('node-cron')
const db = require('../db')
const { getShanghaiDateText } = require('../utils/date')

async function refreshOverdueStatus() {
  const today = getShanghaiDateText()
  const workOrderResult = await db.prepare(
    `UPDATE pms_work_order
     SET is_overdue = CASE
       WHEN expected_resolve_date::date < ?::date AND status NOT IN (2, 3) THEN 1
       ELSE 0
     END
     WHERE is_deleted = 0
       AND is_overdue <> CASE
         WHEN expected_resolve_date::date < ?::date AND status NOT IN (2, 3) THEN 1
         ELSE 0
       END`
  ).run(today, today)

  const taskResult = await db.prepare(
    `UPDATE pms_task
     SET is_overdue = CASE
       WHEN expected_end_date::date < ?::date AND status NOT IN (2, 3) THEN 1
       ELSE 0
     END
     WHERE is_deleted = 0
       AND is_overdue <> CASE
         WHEN expected_end_date::date < ?::date AND status NOT IN (2, 3) THEN 1
         ELSE 0
       END`
  ).run(today, today)

  return { changed: (workOrderResult.changes || 0) + (taskResult.changes || 0), checkedAt: today }
}

/**
 * 每天凌晨 0:30 执行
 * 每天刷新运维工单和任务的 is_overdue 字段。
 * 规则：预计完成时间 < 当天 且状态不是已完成/已关闭 -> is_overdue = 1，否则 = 0
 */
function start() {
  cron.schedule('30 0 * * *', async () => {
    try {
      const result = await refreshOverdueStatus()
      if (result.changed > 0) console.log(`[Cron] 工单逾期刷新：${result.changed} 条状态已更新`)
    } catch (err) {
      console.error('[Cron] 逾期刷新任务执行失败:', err)
    }
  })

  console.log('[Cron] 逾期自动刷新任务已启动（每天 00:30 执行）')
}

module.exports = { refreshOverdueStatus, start }
