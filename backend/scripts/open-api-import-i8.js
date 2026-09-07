const db = require('../src/db')

async function importMappings(clientId,integrationId,{apply = false,database = db} = {}) {
  if (![clientId,integrationId].every((n) => Number.isSafeInteger(n) && n > 0)) throw new Error('clientId/integrationId 必须为正整数')
  return database.transaction(async (tx) => {
    if (!await tx.prepare('SELECT id FROM pms_open_client WHERE id=? FOR UPDATE').get(clientId)) throw new Error('接入系统不存在')
    const config = await tx.prepare('SELECT * FROM pms_integration_config WHERE id=? FOR SHARE').get(integrationId)
    if (config?.adapter_code !== 'i8_it_operations') throw new Error('原接口不是 i8 同步配置')
    if (apply && Number(config.enabled) === 1) throw new Error('请在正式切换时先停用旧同步，再应用映射')
    if (apply && config.last_status === 'running') throw new Error('旧同步仍在执行，请等待结束后重新检查映射')
    const rows = await tx.prepare(`SELECT DISTINCT ON (source_key) source_key,target_type,target_id
      FROM pms_integration_sync_record WHERE integration_config_id=? AND sync_status='success'
      ORDER BY source_key,synced_at DESC,id DESC`).all(integrationId)
    const report = {total:rows.length,ready:[],existing:[],conflicts:[],applied:false}
    const targets = new Set()
    for (const row of rows) {
      const table = {requirement:'pms_requirement',work_order:'pms_work_order'}[row.target_type]
      const target = table ? await tx.prepare(`SELECT id,is_deleted FROM ${table} WHERE id=?`).get(row.target_id) : null
      const existing = await tx.prepare('SELECT * FROM pms_open_record WHERE client_id=? AND resource_type=? AND (source_record_id=? OR target_id=?)').all(clientId,row.target_type,row.source_key,row.target_id)
      const targetKey = `${row.target_type}:${row.target_id}`
      if (!target || Number(target.is_deleted) === 1 || targets.has(targetKey)) report.conflicts.push({...row,reason:'目标不存在、已删除或存在重复绑定'})
      else if (existing.length) {
        if (existing.length === 1 && existing[0].source_record_id === row.source_key && String(existing[0].target_id) === String(row.target_id)) report.existing.push(row)
        else report.conflicts.push({...row,reason:'新接口已有不同映射'})
      } else report.ready.push(row)
      targets.add(targetKey)
    }
    if (apply) {
      if (report.conflicts.length) throw new Error(`发现 ${report.conflicts.length} 条冲突，请先执行检查并处理`)
      for (const row of report.ready) await tx.prepare('INSERT INTO pms_open_record(client_id,resource_type,source_record_id,target_id) VALUES(?,?,?,?)').run(clientId,row.target_type,row.source_key,row.target_id)
      report.applied=true
    }
    return report
  })
}
if (require.main === module) {
  const [client,integration,flag] = process.argv.slice(2)
  importMappings(Number(client),Number(integration),{apply:flag === '--apply'})
    .then((report) => console.log(JSON.stringify(report,null,2)))
    .catch((e) => {console.error(e.message);process.exitCode=1}).finally(() => db.pool.end())
}
module.exports = { importMappings }
