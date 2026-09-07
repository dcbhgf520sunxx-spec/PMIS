const crypto = require('node:crypto')
const defaultDb = require('../db')
const { hash } = require('./openApiContract')
const { allocateOpenClientCode } = require('./openClientCode')
const { parsePagination,getSortDirection } = require('../utils/pagination')

const invalid = (field,message,statusCode = 400) => Object.assign(new Error(message),{field,statusCode})
function validateClientConfig(body) {
  if (!body || Object.keys(body).some((k) => !['name','expiresAt'].includes(k))) throw invalid('name','配置包含不支持的字段')
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100) throw invalid('name','请输入100字符以内的系统名称')
  if (body.expiresAt && (typeof body.expiresAt !== 'string' || !Number.isFinite(Date.parse(body.expiresAt)) || Date.parse(body.expiresAt) <= Date.now())) throw invalid('expiresAt','有效期必须晚于当前时间')
  return {name:body.name.trim(),expiresAt:body.expiresAt || null}
}
const fields = 'c.id,c.code,c.name,c.enabled,c.expires_at,c.scopes,c.operator_ids,c.created_by,c.updated_by,c.created_at,c.updated_at,u.real_name creator_name,(SELECT real_name FROM pms_user WHERE id=c.updated_by) updater_name'
function createOpenClientAdminService(db = defaultDb) {
  async function get(id,connection = db,lock = false) {
    if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw invalid(null,'接入系统不存在',404)
    const row = await connection.prepare(`SELECT ${fields} FROM pms_open_client c LEFT JOIN pms_user u ON u.id=c.created_by WHERE c.id=?${lock ? ' FOR UPDATE OF c' : ''}`).get(Number(id))
    if (!row) throw invalid(null,'接入系统不存在',404)
    return row
  }
  async function save(id,raw,userId,ip) {
    const body = validateClientConfig(raw)
    return db.transaction(async (tx) => {
      let old
      if (id) {
        old = await get(id,tx,true)
        if (old.name === body.name && (old.expires_at ? Date.parse(old.expires_at) : null) === (body.expiresAt ? Date.parse(body.expiresAt) : null)) return old
      }
      let targetId = id
      if (id) await tx.prepare('UPDATE pms_open_client SET name=?,expires_at=?,updated_by=?,updated_at=NOW() WHERE id=?').run(body.name,body.expiresAt,userId,id)
      else {
        const identity = await allocateOpenClientCode(tx)
        const created = await tx.prepare('INSERT INTO pms_open_client(id,code,name,token_hash,expires_at,created_by) VALUES(?,?,?,?,?,?)').run(identity.id,identity.code,body.name,hash(crypto.randomBytes(32).toString('hex')),body.expiresAt,userId)
        targetId = created.lastInsertRowid
      }
      if (old) {
        const expiry = (value) => value ? new Date(value).toISOString() : '长期有效'
        const changes = [
          {field:'系统名称',oldVal:old.name,newVal:body.name},
          {field:'凭证有效期',oldVal:expiry(old.expires_at),newVal:expiry(body.expiresAt)},
        ].filter((change) => change.oldVal !== change.newVal)
        await tx.writeLogs(userId,'编辑','接入系统',targetId,changes,ip,body.name)
      } else await tx.writeLog(userId,'新增','接入系统',targetId,null,null,null,ip,body.name)
      return get(targetId,tx)
    })
  }
  async function action(id,operation,userId,ip) {
    return db.transaction(async (tx) => {
      const row = await get(id,tx,true)
      if (operation === 'rotate') {
        const credential = `sidm_open_${crypto.randomBytes(32).toString('base64url')}`
        await tx.prepare('UPDATE pms_open_client SET token_hash=?,updated_by=?,updated_at=NOW() WHERE id=?').run(hash(credential),userId,id)
        await tx.writeLog(userId,'重置凭证','接入系统',id,null,null,null,ip,row.name)
        return {credential}
      }
      if (!['enable','disable'].includes(operation)) throw invalid('enabled','状态不正确')
      const enabled = operation === 'enable' ? 1 : 0
      if (enabled && row.expires_at && Date.parse(row.expires_at) <= Date.now()) throw invalid(null,'凭证已过期，请先编辑有效期')
      if (Number(row.enabled) !== enabled) {
        await tx.prepare('UPDATE pms_open_client SET enabled=?,updated_by=?,updated_at=NOW() WHERE id=?').run(enabled,userId,id)
        await tx.writeLog(userId,enabled ? '启用' : '停用','接入系统',id,null,null,null,ip,row.name)
      }
      return null
    })
  }
  async function history(id,query) {
    await get(id)
    const {page,pageSize,offset} = parsePagination(query)
    const params = [Number(id)]
    let where = 'r.client_id=?'
    if (query.outcome) {
      if (!['success','failed','replayed'].includes(query.outcome)) throw invalid(null,'调用结果筛选不正确')
      where += ' AND r.outcome=?'; params.push(query.outcome)
    }
    if (query.sourceRecordId) { where += ' AND r.source_record_id ILIKE ?'; params.push(`%${String(query.sourceRecordId).slice(0,100)}%`) }
    const sorts = {createdAt:'r.created_at',resourceType:'r.resource_type',operation:'r.operation',operatorName:'u.real_name',sourceRecordId:'r.source_record_id',outcome:'r.outcome',httpStatus:'r.http_status',requestId:'r.request_id',message:'r.result_json->>\'message\''}
    const sort = sorts[query.sortField] || 'r.created_at'
    const total = await db.prepare(`SELECT COUNT(*) total FROM pms_open_request r WHERE ${where}`).get(...params)
    const list = await db.prepare(`SELECT r.id,r.request_id,r.resource_type,r.source_record_id,r.operation,r.outcome,r.http_status,r.created_at,u.real_name operator_name,
      r.result_json->>'message' message,r.result_json->>'result' result,r.result_json->'fieldErrors' field_errors
      FROM pms_open_request r LEFT JOIN pms_user u ON u.id=r.operator_id WHERE ${where}
      ORDER BY ${sort} ${getSortDirection(query.sortOrder)},r.id DESC LIMIT ? OFFSET ?`).all(...params,pageSize,offset)
    return {list,total:Number(total.total),page,pageSize}
  }
  return {get,save,action,history,list:() => db.prepare(`SELECT ${fields} FROM pms_open_client c LEFT JOIN pms_user u ON u.id=c.created_by ORDER BY c.id DESC`).all()}
}
module.exports = {createOpenClientAdminService,validateClientConfig}
