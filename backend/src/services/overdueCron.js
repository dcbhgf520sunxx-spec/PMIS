const { overdueSql } = require('./overdueRules')
const cron = require('node-cron')
const db = require('../db')
const { getShanghaiDateText } = require('../utils/date')

async function refreshOverdueStatus() {
  const today = getShanghaiDateText()
  let changed = 0
  for (const type of ['project', 'requirement', 'task', 'work_order']) {
    const { flag } = overdueSql(type)
    const result = await db.prepare(`UPDATE pms_${type} SET is_overdue = ${flag}
      WHERE is_deleted = 0 AND is_overdue IS DISTINCT FROM ${flag}`).run()
    changed += result.changes || 0
  }

  return { changed, checkedAt: today }
}

/**
 * 每天凌晨 0:30 执行
 * 每天刷新业务逾期缓存；查询始终实时计算。
 * 规则：运维工单已解决、任务已完成或已暂停时不逾期；其他状态按预计完成时间判断。
 */
function start() {
  cron.schedule('30 0 * * *', async () => {
    try {
      const result = await refreshOverdueStatus()
      if (result.changed > 0) console.log(`[Cron] 工单逾期刷新：${result.changed} 条状态已更新`)
    } catch (err) {
      console.error('[Cron] 逾期刷新任务执行失败:', err)
    }
  }, { timezone: 'Asia/Shanghai' })

  console.log('[Cron] 逾期自动刷新任务已启动（每天 00:30 执行）')
}

module.exports = { refreshOverdueStatus, start }
