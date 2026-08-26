const crypto = require('crypto')
const db = require('../db')
const { mapItopsRecord, mergeSyncedSection, resolveSyncWindow } = require('./itopsSyncRules')
const { DEFAULT_PRIORITY } = require('./priorityRules')

const INTEGRATION_CODE = 'i8_it_operations'
const TASK_CODE = 'integration_sync'
const PAYLOAD_MAPPING_VERSION = '2026-08-26-source-submitter-v5'

const payloadHash = (record, mappingVersion = PAYLOAD_MAPPING_VERSION) => crypto.createHash('sha256')
  .update(JSON.stringify({ mappingVersion, record }))
  .digest('hex')
const errorText = (error, max = 1000) => String(error?.message || error || '未知错误').slice(0, max)

async function requestExternalRecords(config, window, fetchImpl = global.fetch) {
  if (!fetchImpl) throw new Error('当前运行环境不支持访问外部接口')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetchImpl(config.endpoint_url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kssj: window.start, jssj: '' }), signal: controller.signal,
    })
    if (!response.ok) throw new Error(`i8 接口请求失败：HTTP ${response.status}`)
    const body = await response.json()
    if (body?.status === 'error' && body?.message === '数据未找到' && body?.data == null) return []
    if (body?.status !== 'success') throw new Error(`i8 接口返回失败：${body?.message || body?.status || '未知错误'}`)
    if (!Array.isArray(body.data)) throw new Error('i8 接口返回格式错误：data 不是数组')
    return body.data
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('i8 接口请求超时（30 秒）')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function getConfig(database = db, id = null) {
  const whereClause = id == null ? 'c.code=?' : 'c.id=?'
  const lookupValue = id == null ? INTEGRATION_CODE : Number(id)
  const config = await database.prepare(`SELECT c.* FROM pms_integration_config c WHERE ${whereClause}`).get(lookupValue)
  if (!config) return config
  const values = config.config_json || {}
  const configuredProductId = Number(values.product_id)
  const configuredOwnerId = Number(values.fallback_owner_id)
  let product = configuredProductId
    ? await database.prepare(`SELECT id,name FROM pms_product
      WHERE id=? AND status=1 AND is_deleted=0`).get(configuredProductId)
    : null
  if (!product) {
    product = await database.prepare(`SELECT id,name FROM pms_product
      WHERE name='i8项目管理系统' AND status=1 AND is_deleted=0 ORDER BY id LIMIT 1`).get()
  }
  let owner = configuredOwnerId
    ? await database.prepare(`SELECT id,real_name name FROM pms_user
      WHERE id=? AND status=1 AND is_deleted=0`).get(configuredOwnerId)
    : null
  if (!owner) {
    owner = await database.prepare(`SELECT id,real_name name FROM pms_user
      WHERE real_name='韩健' AND status=1 AND is_deleted=0 ORDER BY id LIMIT 1`).get()
  }
  return {
    ...config,
    config_json: {
      ...values,
      ...(product ? { product_id: Number(product.id) } : {}),
      ...(owner ? { fallback_owner_id: Number(owner.id) } : {}),
    },
    product_name: product?.name,
    fallback_owner_name: owner?.name,
  }
}

function validateConnectionConfig(config) {
  if (!config) throw new Error('未找到 i8 运维单据同步配置')
  if (!config.endpoint_url) throw new Error('请先配置 i8 接口地址')
}

function validateConfig(config) {
  validateConnectionConfig(config)
  const values = config.config_json || {}
  config.product_id = Number(values.product_id)
  config.fallback_owner_id = Number(values.fallback_owner_id)
  if (!config.product_id || !config.product_name) throw new Error('请先配置有效的“i8项目管理系统”产品')
  if (!config.fallback_owner_id || !config.fallback_owner_name) throw new Error('请先配置有效的兜底负责人“韩健”')
}

async function resolveOwner(tx, sourceOwnerName, fallbackOwnerId) {
  const name = String(sourceOwnerName || '').trim()
  if (name) {
    const user = await tx.prepare(`SELECT id,real_name FROM pms_user
      WHERE real_name=? AND status=1 AND is_deleted=0 ORDER BY id LIMIT 1`).get(name)
    if (user) return { id: user.id, name: user.real_name, warning: null }
  }
  const fallback = await tx.prepare(`SELECT id,real_name FROM pms_user
    WHERE id=? AND status=1 AND is_deleted=0`).get(fallbackOwnerId)
  if (!fallback) throw new Error('兜底负责人不存在或已停用')
  return { id: fallback.id, name: fallback.real_name,
    warning: name ? `负责人“${name}”未匹配到有效账号，已分配给${fallback.real_name}` : `负责人为空，已分配给${fallback.real_name}` }
}

async function resolveProblemType(tx, name) {
  const row = await tx.prepare(`SELECT a.id FROM pms_archive a JOIN pms_archive_type t ON t.id=a.archive_type_id
    WHERE a.name=? AND a.status=1 AND a.is_deleted=0 AND t.name='问题类型' AND t.status=1 AND t.is_deleted=0
    ORDER BY a.id LIMIT 1`).get(name)
  if (!row) throw new Error(`未找到有效的问题类型“${name}”`)
  return row.id
}

function isOverdue(dateValue, completed) {
  if (!dateValue || completed) return 0
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return dateValue < today ? 1 : 0
}

function collectHistoryChanges(target, nextValues, dateFields = []) {
  const dateFieldSet = new Set(dateFields)
  const comparable = (field, value) => {
    if (value == null) return ''
    const text = String(value)
    return dateFieldSet.has(field) ? text.slice(0, 10) : text
  }
  return Object.entries(nextValues)
    .filter(([field, value]) => comparable(field, target?.[field]) !== comparable(field, value))
    .map(([field, value]) => ({
      field,
      oldVal: dateFieldSet.has(field) && target?.[field] != null
        ? String(target[field]).slice(0, 10)
        : target?.[field] ?? null,
      newVal: dateFieldSet.has(field) && value != null ? String(value).slice(0, 10) : value,
    }))
}

async function uniqueRequirementTitle(tx, title, externalCode, targetId) {
  const duplicate = targetId
    ? await tx.prepare(`SELECT id FROM pms_requirement
      WHERE title=? AND is_deleted=0 AND id<>? LIMIT 1`).get(title, targetId)
    : await tx.prepare(`SELECT id FROM pms_requirement
      WHERE title=? AND is_deleted=0 LIMIT 1`).get(title)
  if (!duplicate) return title
  const suffix = `（${externalCode}）`
  return `${title.slice(0, Math.max(1, 200 - suffix.length))}${suffix}`
}

async function saveRequirement(tx, mapped, config, owner, target, actorId) {
  const title = await uniqueRequirementTitle(tx, mapped.title, mapped.externalCode, target?.id)
  const description = mergeSyncedSection(target?.description, mapped.syncedSection)
  const overdue = isOverdue(mapped.expectedEndDate, mapped.status === 33)
  const submitterName = String(mapped.submitterName || '').trim() || 'i8'
  const submitterDept = String(mapped.submitterDept || '').trim() || 'i8'
  const nextValues = {
    title,
    description,
    requirement_type: 4,
    product_id: config.product_id,
    owner_id: owner.id,
    status: mapped.status,
    is_overdue: overdue,
    submitter_name: submitterName,
    submitter_dept: submitterDept,
    submit_date: mapped.submitDate,
    expected_end_date: mapped.expectedEndDate,
    actual_end_date: mapped.actualEndDate,
    completion_status: mapped.completionStatus,
  }
  if (target) {
    await tx.prepare(`UPDATE pms_requirement SET title=?,description=?,requirement_type=4,product_id=?,owner_id=?,
      status=?,is_overdue=?,submitter_name=?,submitter_dept=?,submit_date=?,expected_end_date=?,
      actual_end_date=?,completion_status=?,updater_id=?,updated_at=NOW() WHERE id=?`).run(title, description, config.product_id,
      owner.id, mapped.status, overdue, submitterName, submitterDept, mapped.submitDate, mapped.expectedEndDate,
      mapped.actualEndDate, mapped.completionStatus, actorId, target.id)
    const changes = collectHistoryChanges(target, nextValues, ['submit_date', 'expected_end_date', 'actual_end_date'])
    if (changes.length) await tx.writeLogs(actorId, 'i8同步更新', '需求', target.id, changes, null, title)
    return target.id
  }
  const result = await tx.prepare(`INSERT INTO pms_requirement
    (title,description,requirement_type,product_id,owner_id,priority,status,is_overdue,submitter_name,submitter_dept,
      submit_date,expected_end_date,actual_end_date,completion_status,creator_id,updater_id)
    VALUES (?,?,4,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(title, description, config.product_id, owner.id,
      DEFAULT_PRIORITY, mapped.status, overdue, submitterName, submitterDept, mapped.submitDate, mapped.expectedEndDate, mapped.actualEndDate,
      mapped.completionStatus, owner.id, actorId)
  await tx.writeLog(actorId, 'i8同步新增', '需求', result.lastInsertRowid, null, null, null, null, title)
  return result.lastInsertRowid
}

async function saveWorkOrder(tx, mapped, config, owner, target, actorId) {
  const problemType = await resolveProblemType(tx, mapped.problemTypeName)
  const problemDesc = mergeSyncedSection(target?.problem_desc, mapped.syncedSection)
  const resultDesc = mapped.solution ? mergeSyncedSection(target?.result_desc, `解决方案：${mapped.solution}`) : target?.result_desc || null
  const overdue = isOverdue(mapped.expectedEndDate, mapped.status === 2)
  const submitterName = String(mapped.submitterName || '').trim() || 'i8'
  const submitterDept = String(mapped.submitterDept || '').trim() || 'i8'
  const nextValues = {
    product_id: config.product_id,
    problem_type: problemType,
    problem_desc: problemDesc,
    result_desc: resultDesc,
    follower_id: owner.id,
    urgency: mapped.priority,
    status: mapped.status,
    is_overdue: overdue,
    expected_resolve_date: mapped.expectedEndDate,
    resolve_date: mapped.actualEndDate,
    submitter_name: submitterName,
    submitter_dept: submitterDept,
    submit_time: mapped.submitDate,
  }
  if (target) {
    await tx.prepare(`UPDATE pms_work_order SET product_id=?,problem_type=?,problem_desc=?,result_desc=?,follower_id=?,
      urgency=?,status=?,is_overdue=?,expected_resolve_date=?,resolve_date=?,submitter_name=?,submitter_dept=?,
      submit_time=?,updater_id=?,updated_at=NOW() WHERE id=?`).run(config.product_id, problemType, problemDesc,
      resultDesc, owner.id, mapped.priority, mapped.status, overdue, mapped.expectedEndDate, mapped.actualEndDate,
      submitterName, submitterDept, mapped.submitDate, actorId, target.id)
    const changes = collectHistoryChanges(target, nextValues, ['expected_resolve_date', 'resolve_date', 'submit_time'])
    if (changes.length) await tx.writeLogs(actorId, 'i8同步更新', '运维工单', target.id, changes, null, mapped.problemDescription)
    return target.id
  }
  const result = await tx.prepare(`INSERT INTO pms_work_order
    (product_id,problem_type,problem_desc,result_desc,follower_id,urgency,status,is_overdue,expected_resolve_date,
      resolve_date,submitter_name,submitter_dept,submit_time,creator_id,updater_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(config.product_id, problemType, problemDesc, resultDesc,
      owner.id, mapped.priority, mapped.status, overdue, mapped.expectedEndDate, mapped.actualEndDate,
      submitterName, submitterDept, mapped.submitDate, owner.id, actorId)
  await tx.writeLog(actorId, 'i8同步新增', '运维工单', result.lastInsertRowid, null, null, null, null, mapped.problemDescription)
  return result.lastInsertRowid
}

async function loadTarget(tx, mapping) {
  if (!mapping?.target_id) return null
  if (mapping.target_type === 'requirement') return tx.prepare(`SELECT id,title,description,requirement_type,product_id,
    owner_id,priority,status,is_overdue,submitter_name,submitter_dept,submit_date,expected_end_date,actual_end_date,
    completion_status,creator_id,is_deleted FROM pms_requirement WHERE id=?`).get(mapping.target_id)
  return tx.prepare(`SELECT id,product_id,problem_type,problem_desc,result_desc,follower_id,urgency,status,is_overdue,
    expected_resolve_date,resolve_date,submitter_name,submitter_dept,submit_time,creator_id,is_deleted
    FROM pms_work_order WHERE id=?`).get(mapping.target_id)
}

async function appendSyncRecord(tx, value) {
  await tx.prepare(`INSERT INTO pms_integration_sync_record
    (integration_config_id,batch_execution_id,source_key,source_type,target_type,target_id,source_updated_at,
      payload_hash,payload_summary,sync_status,warning_message,error_message,synced_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW())`).run(
    value.configId, value.batchId, value.sourceKey, value.sourceType, value.targetType || null,
    value.targetId || null, value.sourceUpdatedAt || null, value.hash, JSON.stringify(value.payload), value.status,
    value.warning || null, value.error || null)
}

const priorityText = (value) => ({ 0: '低', 1: '中', 2: '高' }[Number(value)] || '未设置')

function formatSyncRecordForDisplay(row) {
  const actionCode = row.execution_action_code || (row.sync_status === 'failed' ? 'failed' : row.sync_status)
  let executionAction = '处理'
  let processingNote = '同步记录已处理'
  if (actionCode === 'created') {
    executionAction = '新增'
    processingNote = row.target_type === 'requirement'
      ? '新增需求，优先级按系统默认设为低'
      : '新增运维工单'
  } else if (actionCode === 'updated') {
    executionAction = '更新'
    processingNote = row.target_type === 'requirement'
      ? `更新已有需求，保留原优先级${priorityText(row.target_priority)}，未覆盖人工调整`
      : '更新已有运维工单'
  } else if (actionCode === 'skipped') {
    executionAction = '跳过'
    processingNote = '源数据无变化，本次未重复更新'
  } else if (actionCode === 'failed') {
    executionAction = '失败'
    processingNote = '同步失败，具体原因见失败原因'
  }
  return { ...row, execution_action: executionAction, processing_note: processingNote }
}

async function syncOneRecord(record, config, batchId, actorId, database = db) {
  const hash = payloadHash(record)
  const externalCode = String(record?.单据编码 || '').trim()
  try {
    return await database.transaction(async (tx) => {
      const mapped = mapItopsRecord(record)
      const mapping = await tx.prepare(`SELECT * FROM pms_integration_sync_record
        WHERE integration_config_id=? AND source_key=? AND sync_status='success'
        ORDER BY synced_at DESC,id DESC LIMIT 1 FOR UPDATE`).get(config.id, mapped.externalCode)
      if (mapping && mapping.source_type !== mapped.sourceCategory) throw new Error(`单据类别已从“${mapping.source_type}”变为“${mapped.sourceCategory}”，禁止自动迁移业务类型`)
      if (mapping?.sync_status === 'success' && mapping.payload_hash === hash) {
        await appendSyncRecord(tx, { configId: config.id, batchId, sourceKey: mapped.externalCode,
          sourceType: mapped.sourceCategory, targetType: mapping.target_type, targetId: mapping.target_id,
          sourceUpdatedAt: mapped.externalUpdatedAt, hash, payload: record, status: 'skipped',
          warning: mapping.warning_message || null })
        return { status: 'skipped', externalCode: mapped.externalCode, warning: mapping.warning_message || null }
      }
      const target = await loadTarget(tx, mapping)
      if (target?.is_deleted === 1) throw new Error('已关联的 PMIS 数据已删除，禁止自动重建')
      if (mapping?.target_id && !target) throw new Error('已关联的 PMIS 数据不存在，禁止自动重建')
      const owner = await resolveOwner(tx, mapped.sourceOwnerName, config.fallback_owner_id)
      const targetId = mapped.targetType === 'requirement'
        ? await saveRequirement(tx, mapped, config, owner, target, actorId)
        : await saveWorkOrder(tx, mapped, config, owner, target, actorId)
      const warning = [mapped.warning, owner.warning].filter(Boolean).join('；') || null
      await appendSyncRecord(tx, { configId: config.id, batchId, sourceKey: mapped.externalCode,
        sourceType: mapped.sourceCategory, targetType: mapped.targetType, targetId,
        sourceUpdatedAt: mapped.externalUpdatedAt, hash, payload: record, status: 'success', warning })
      return { status: 'success', externalCode: mapped.externalCode, targetType: mapped.targetType, targetId, warning }
    })
  } catch (error) {
    if (externalCode) {
      const previous = await database.prepare(`SELECT target_type,target_id FROM pms_integration_sync_record
        WHERE integration_config_id=? AND source_key=? AND sync_status='success'
        ORDER BY synced_at DESC,id DESC LIMIT 1`).get(config.id, externalCode)
      await database.transaction((tx) => appendSyncRecord(tx, { configId: config.id, batchId, sourceKey: externalCode,
        sourceType: String(record?.问题类别 || '').trim() || '未知', targetType: previous?.target_type,
        targetId: previous?.target_id, sourceUpdatedAt: record?.更新时间, hash, payload: record,
        status: 'failed', error: errorText(error) }))
    }
    return { status: 'failed', externalCode: externalCode || '-', error: errorText(error) }
  }
}

async function syncItops({ trigger = 'manual', userId = null, fetchImpl = global.fetch, now = new Date(), config: providedConfig = null } = {}, database = db) {
  const config = providedConfig || await getConfig(database)
  validateConfig(config)
  if (Number(config.enabled) !== 1) return { skipped: true, reason: '接口同步未启用' }
  const claimed = await database.prepare(`UPDATE pms_integration_config SET last_status='running',last_started_at=NOW(),last_error=NULL,updated_at=NOW()
    WHERE id=? AND (last_status<>'running' OR last_started_at<NOW()-INTERVAL '2 hours')`).run(config.id)
  if (!claimed.changes) throw new Error('同步任务正在执行，请勿重复操作')
  const executionKey = `${trigger}-${now.toISOString()}-${crypto.randomUUID()}`
  const batch = await database.prepare(`INSERT INTO pms_scheduled_task_execution(task_code,target_type,target_id,execution_key,status)
    VALUES (?,'integration',?,?,'running')`).run(TASK_CODE, config.id, executionKey)
  const batchId = batch.lastInsertRowid
  const window = resolveSyncWindow({
    now,
    lastSuccessAt: config.last_cursor_at || null,
    initialSyncDate: config.initial_sync_date,
  })
  try {
    const fetched = await requestExternalRecords(config, window, fetchImpl)
    const retries = await database.prepare(`SELECT source_key,payload_summary FROM (
      SELECT DISTINCT ON (source_key) source_key,payload_summary,sync_status
      FROM pms_integration_sync_record WHERE integration_config_id=? AND payload_summary IS NOT NULL
      ORDER BY source_key,synced_at DESC,id DESC
    ) latest WHERE sync_status='failed'`).all(config.id)
    const byCode = new Map()
    for (const record of [...retries.map((row) => row.payload_summary), ...fetched]) {
      const code = String(record?.单据编码 || '').trim()
      byCode.set(code || `invalid-${byCode.size}`, record)
    }
    const results = []
    const actorId = userId || config.fallback_owner_id
    for (const record of byCode.values()) results.push(await syncOneRecord(record, config, batchId, actorId, database))
    const summary = { trigger, window, total: results.length,
      success: results.filter((item) => item.status === 'success').length,
      skipped: results.filter((item) => item.status === 'skipped').length,
      failed: results.filter((item) => item.status === 'failed').length,
      warnings: results.filter((item) => item.warning).length,
      errors: results.filter((item) => item.status === 'failed').slice(0, 20) }
    const status = summary.failed ? 'failed' : 'success'
    const message = summary.failed ? `${summary.failed} 条数据同步失败` : null
    await database.prepare(`UPDATE pms_scheduled_task_execution SET status=?,result_data=?,error_message=?,finished_at=NOW(),updated_at=NOW() WHERE id=?`).run(status, JSON.stringify(summary), message, batchId)
    await database.prepare(`UPDATE pms_integration_config SET last_cursor_at=?,last_finished_at=NOW(),last_status=?,
      last_total_count=?,last_success_count=?,last_failure_count=?,last_warning_count=?,last_error=?,updater_id=?,updated_at=NOW() WHERE id=?`).run(
      `${window.end} 23:59:59+08`, status, summary.total, summary.success + summary.skipped, summary.failed,
      summary.warnings, message, actorId, config.id)
    return { batchId, ...summary }
  } catch (error) {
    const message = errorText(error, 500)
    await database.prepare(`UPDATE pms_scheduled_task_execution SET status='failed',error_message=?,finished_at=NOW(),updated_at=NOW() WHERE id=?`).run(message, batchId)
    await database.prepare(`UPDATE pms_integration_config SET last_finished_at=NOW(),last_status='failed',last_error=?,updater_id=?,updated_at=NOW() WHERE id=?`).run(message, userId || config.fallback_owner_id, config.id)
    throw error
  }
}

async function testConnection(providedConfig = null, fetchImpl = global.fetch, database = db) {
  const config = providedConfig || await getConfig(database)
  validateConnectionConfig(config)
  const window = resolveSyncWindow({
    now: new Date(),
    lastSuccessAt: config.last_cursor_at || null,
    initialSyncDate: config.initial_sync_date,
  })
  const records = await requestExternalRecords(config, window, fetchImpl)
  return { connected: true, recordCount: records.length, window }
}

module.exports = {
  INTEGRATION_CODE,
  appendSyncRecord,
  formatSyncRecordForDisplay,
  getConfig,
  payloadHash,
  requestExternalRecords,
  saveRequirement,
  saveWorkOrder,
  syncItops,
  testConnection,
  uniqueRequirementTitle,
}
