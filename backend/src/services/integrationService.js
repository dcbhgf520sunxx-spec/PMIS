const cron = require('node-cron')
const db = require('../db')
const itopsAdapter = require('./itopsSyncService')

const adapters = {
  i8_it_operations: {
    sync: async (config, options, database) => itopsAdapter.syncItops({ ...options, config: await itopsAdapter.getConfig(database, config.id) }, database),
    testConnection: async (config, options, database) => itopsAdapter.testConnection(await itopsAdapter.getConfig(database, config.id), options?.fetchImpl, database),
  },
}

function resolveIntegrationAdapter(config) {
  const code = String(config?.adapter_code || '').trim()
  const adapter = adapters[code]
  if (!adapter) throw new Error(`暂不支持的接口适配器：${code || '未配置'}`)
  return adapter
}

function isIntegrationDue(config, now = new Date()) {
  if (Number(config?.enabled) !== 1 || Number(config?.auto_enabled) !== 1) return false
  if (!config.auto_start_at) return false
  const startAt = new Date(config.auto_start_at)
  if (Number.isNaN(startAt.getTime()) || now.getTime() < startAt.getTime()) return false
  if (!config.last_auto_started_at || new Date(config.last_auto_started_at).getTime() < startAt.getTime()) return true
  const interval = Math.max(1, Number(config.sync_interval_hours) || 1) * 60 * 60 * 1000
  return now.getTime() - new Date(config.last_auto_started_at).getTime() >= interval
}

async function listDueIntegrations(database = db, now = new Date()) {
  const rows = await database.prepare(`SELECT config.*,
      (SELECT MAX(execution.started_at)
        FROM pms_scheduled_task_execution execution
        WHERE execution.task_code='integration_sync'
          AND execution.target_type='integration'
          AND execution.target_id=config.id
          AND execution.execution_key LIKE 'auto-%') last_auto_started_at
    FROM pms_integration_config config
    WHERE config.enabled=1 AND config.auto_enabled=1
    ORDER BY config.id`).all()
  return rows.filter((row) => isIntegrationDue(row, now))
}

async function runIntegration(config, options = {}, database = db) {
  if (!config) throw new Error('接口配置不存在')
  if (Number(config.enabled) !== 1) throw new Error('接口已停用，无法执行同步')
  return resolveIntegrationAdapter(config).sync(config, options, database)
}

async function testIntegration(config, options = {}, database = db) {
  if (!config) throw new Error('接口配置不存在')
  return resolveIntegrationAdapter(config).testConnection(config, options, database)
}

async function runDueIntegrations(database = db, now = new Date()) {
  const due = await listDueIntegrations(database, now)
  for (const config of due) {
    try {
      await runIntegration(config, { trigger: 'auto', now }, database)
    } catch (error) {
      console.error(`接口自动同步失败[${config.code}]:`, error.message)
    }
  }
  return due.length
}

function start() {
  cron.schedule('* * * * *', () => runDueIntegrations().catch((error) => console.error('接口自动执行检查失败:', error.message)))
  console.log('接口自动执行调度已启动：每分钟检查到期配置')
}

module.exports = {
  isIntegrationDue,
  listDueIntegrations,
  resolveIntegrationAdapter,
  runDueIntegrations,
  runIntegration,
  start,
  testIntegration,
}
