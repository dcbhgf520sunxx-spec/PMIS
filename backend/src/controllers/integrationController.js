const db = require('../db')
const { ok, fail, failField } = require('../utils/response')
const { parsePagination } = require('../utils/pagination')
const { runIntegration, testIntegration } = require('../services/integrationService')
const { formatSyncRecordForDisplay } = require('../services/itopsSyncService')

const loadConfig = (id) => db.prepare('SELECT * FROM pms_integration_config WHERE id=?').get(Number(id))

exports.list = async (_req, res) => {
  try {
    const list = await db.prepare(`SELECT id,code,name,adapter_code,endpoint_url,request_method,enabled,auto_enabled,
      sync_interval_hours,auto_start_at,initial_sync_date,last_started_at,last_finished_at,last_status,last_total_count,
      last_success_count,last_failure_count,last_warning_count,last_error
      FROM pms_integration_config ORDER BY id`).all()
    ok(res, list)
  } catch (error) { console.error(error); fail(res, 500, 500, '查询接口配置失败') }
}

exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!await loadConfig(id)) return fail(res, 404, 404, '接口配置不存在')
    const name = String(req.body.name || '').trim()
    const endpoint = String(req.body.endpoint_url || '').trim()
    const interval = Number(req.body.sync_interval_hours)
    const autoEnabled = Number(req.body.auto_enabled) === 1 ? 1 : 0
    const autoStartAt = req.body.auto_start_at ? new Date(req.body.auto_start_at) : null
    if (!name) return failField(res, 'name', '请输入接口名称')
    if (!/^https?:\/\//i.test(endpoint)) return failField(res, 'endpoint_url', '请输入正确的 HTTP 或 HTTPS 接口地址')
    if (!Number.isInteger(interval) || interval < 1 || interval > 720) return failField(res, 'sync_interval_hours', '自动执行间隔须为 1 至 720 小时')
    if (autoEnabled && (!autoStartAt || Number.isNaN(autoStartAt.getTime()))) {
      return failField(res, 'auto_start_at', '启用自动执行时请选择首次执行时间')
    }
    if (autoStartAt && Number.isNaN(autoStartAt.getTime())) return failField(res, 'auto_start_at', '首次执行时间格式不正确')
    await db.prepare(`UPDATE pms_integration_config SET name=?,endpoint_url=?,auto_enabled=?,
      sync_interval_hours=?,auto_start_at=?,updater_id=?,updated_at=NOW() WHERE id=?`).run(
      name, endpoint, autoEnabled, interval, autoStartAt, req.user.id, id)
    ok(res, null)
  } catch (error) { console.error(error); fail(res, 500, 500, '保存接口配置失败') }
}

exports.changeStatus = async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!await loadConfig(id)) return fail(res, 404, 404, '接口配置不存在')
    const enabled = Number(req.body.enabled)
    if (![0, 1].includes(enabled)) return failField(res, 'enabled', '接口状态只能为启用或停用')
    await db.prepare('UPDATE pms_integration_config SET enabled=?,updater_id=?,updated_at=NOW() WHERE id=?')
      .run(enabled, req.user.id, id)
    ok(res, null, enabled === 1 ? '接口已启用' : '接口已停用')
  } catch (error) { console.error(error); fail(res, 500, 500, '修改接口状态失败') }
}

exports.test = async (req, res) => {
  try {
    const config = await loadConfig(req.params.id)
    if (!config) return fail(res, 404, 404, '接口配置不存在')
    ok(res, await testIntegration(config), '连接成功')
  } catch (error) { fail(res, 400, 400, error.message || '连接失败') }
}

exports.sync = async (req, res) => {
  try {
    const config = await loadConfig(req.params.id)
    if (!config) return fail(res, 404, 404, '接口配置不存在')
    ok(res, await runIntegration(config, { trigger: 'manual', userId: req.user.id }), '同步完成')
  } catch (error) { fail(res, 400, 400, error.message || '同步失败') }
}

exports.executions = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query)
    const rows = await db.prepare(`SELECT COUNT(*) OVER() total,id,execution_key,status,error_message,result_data,started_at,finished_at,
      CASE WHEN execution_key LIKE 'auto-%' THEN 'auto' ELSE 'manual' END trigger_type
      FROM pms_scheduled_task_execution WHERE target_type='integration' AND target_id=?
      ORDER BY started_at DESC,id DESC LIMIT ? OFFSET ?`).all(Number(req.params.id), pageSize, offset)
    ok(res, { list: rows, total: Number(rows[0]?.total || 0), page, pageSize })
  } catch (error) { console.error(error); fail(res, 500, 500, '查询执行历史失败') }
}

exports.records = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query)
    const rows = await db.prepare(`SELECT COUNT(*) OVER() total,r.id,r.source_key,r.source_type,r.target_type,r.target_id,
      r.sync_status,r.warning_message,r.error_message,r.synced_at,requirement.priority target_priority,
      CASE
        WHEN r.sync_status='skipped' THEN 'skipped'
        WHEN r.sync_status='failed' THEN 'failed'
        WHEN EXISTS (
          SELECT 1 FROM pms_integration_sync_record previous
          WHERE previous.integration_config_id=r.integration_config_id
            AND previous.source_key=r.source_key
            AND previous.sync_status='success'
            AND (previous.synced_at<r.synced_at OR (previous.synced_at=r.synced_at AND previous.id<r.id))
        ) THEN 'updated'
        ELSE 'created'
      END execution_action_code
      FROM pms_integration_sync_record r
      LEFT JOIN pms_requirement requirement ON r.target_type='requirement' AND requirement.id=r.target_id
      WHERE r.integration_config_id=? AND r.batch_execution_id=?
      ORDER BY r.synced_at DESC,r.id DESC LIMIT ? OFFSET ?`).all(
      Number(req.params.id), Number(req.params.executionId), pageSize, offset)
    ok(res, { list: rows.map(formatSyncRecordForDisplay), total: Number(rows[0]?.total || 0), page, pageSize })
  } catch (error) { console.error(error); fail(res, 500, 500, '查询同步明细失败') }
}
