const crypto = require('node:crypto')
const defaultDb = require('../db')
const { createRequirementController } = require('../controllers/requirementController')
const { createWorkOrderController } = require('../controllers/workOrderController')
const { invokeController } = require('../mcp/controllerAdapter')
const { getAllowedMenuPaths } = require('./mcpPermissionService')
const { allowedRequirementStatuses } = require('./requirementRules')
const { allowedWorkOrderStatuses } = require('./workOrderStatusRules')
const attachments = require('./businessAttachmentService')
const { validateAttachmentFile, normalizeOriginalName } = require('./projectContractAttachmentService')
const { cachedOpenUpload } = require('./openAttachmentStore')
const { maps, statusMaps, parseInput, readOperations, requestHash, hash, error } = require('./openApiContract')

const tableFor = { requirement: 'pms_requirement', work_order: 'pms_work_order' }
const menuFor = { requirement: '/requirements', work_order: '/work-orders' }
const labels = { requirement: '需求', work_order: '运维工单' }
const statusLabels = {
  requirement: { 0:'上会评估',1:'需求上会',2:'上会通过',3:'过会未通过',10:'提报评估',11:'需求审批',12:'审批通过',13:'审批未通过',20:'需求验证',21:'预研通过',22:'预研不通过',30:'需求整理',31:'实施中',32:'试运行',33:'已完成',34:'已完成未使用',35:'暂停' },
  work_order: { 0:'待处理',1:'处理中',2:'已解决',4:'已暂停',5:'被激活' },
}

function createOpenApiService({ db = defaultDb, upload = cachedOpenUpload } = {}) {
  async function authenticate(token, connection = db) {
    if (!token || !/^sidm_open_[A-Za-z0-9_-]{43}$/.test(token)) throw error('访问凭证无效', 401)
    const client = await connection.prepare('SELECT * FROM pms_open_client WHERE token_hash=?').get(hash(token))
    if (!client || (client.expires_at && Date.parse(client.expires_at) <= Date.now())) throw error('访问凭证无效或已过期', 401)
    if (Number(client.enabled) !== 1) throw error('接口已停用', 403)
    return client
  }
  async function authorize(client, resource, operation, employeeNo, connection) {
    const user = await connection.prepare('SELECT id,employee_no,real_name FROM pms_user WHERE employee_no=? AND status=1 AND is_deleted=0').get(employeeNo)
    if (!user) throw error('操作人不存在或已停用', 403)
    if (menuFor[resource]) {
      const paths = await getAllowedMenuPaths(user.id, connection)
      if (!paths.has(menuFor[resource])) throw error('操作人没有业务访问权限', 403)
    }
    return { ...user, employeeNo: user.employee_no }
  }
  async function log(connection, ctx, outcome, status, result) {
    await connection.prepare(`INSERT INTO pms_open_request
      (request_id,client_id,operator_id,resource_type,source_record_id,operation,idempotency_key,request_hash,outcome,http_status,result_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(ctx.requestId,ctx.client.id,ctx.user?.id || null,ctx.resource,
      typeof ctx.input?.sourceRecordId === 'string' ? ctx.input.sourceRecordId.slice(0,100) : null,
      String(ctx.input?.operation || 'INVALID').slice(0,40),
      typeof ctx.input?.idempotencyKey === 'string' ? ctx.input.idempotencyKey.slice(0,100) : null,
      ctx.digest || null,outcome,status,JSON.stringify(result))
  }
  async function convertData(resource, input, connection) {
    const selected = input.operation === 'CHANGE_STATUS' ? statusMaps[resource] : maps[resource]
    const result = {}
    for (const [key, value] of Object.entries(input.data)) {
      let mapped = value
      if (key === 'productName') mapped = (await connection.prepare('SELECT id FROM pms_product WHERE name=? AND status=1 AND is_deleted=0').get(value))?.id
      if (['ownerEmployeeNo','followerEmployeeNo'].includes(key)) mapped = (await connection.prepare('SELECT id FROM pms_user WHERE employee_no=? AND status=1 AND is_deleted=0').get(value))?.id
      if (key === 'problemTypeCode') mapped = (await connection.prepare(`SELECT a.id FROM pms_archive a JOIN pms_archive_type t ON t.id=a.archive_type_id
        WHERE a.code=? AND t.code_prefix='PT' AND a.status=1 AND a.is_deleted=0 AND t.status=1 AND t.is_deleted=0`).get(value))?.id
      if (mapped === undefined) throw error('关联数据不存在或已停用',400,{ [key]: ['请使用有效的产品、人员或问题类型'] })
      result[selected[key]] = mapped
    }
    return result
  }
  async function queryData(resource, row, connection) {
    const data = { targetId: row.id }
    for (const [key, field] of Object.entries({ ...maps[resource], ...statusMaps[resource] })) {
      data[key] = row[field] ?? null
      if (data[key] && (/Date$/.test(key) || key === 'submitTime')) data[key] = String(data[key]).slice(0,10)
    }
    data.productName = (await connection.prepare('SELECT name FROM pms_product WHERE id=?').get(row.product_id))?.name || null
    const people = await connection.prepare('SELECT id,employee_no,real_name FROM pms_user WHERE id=ANY(?::bigint[])').all([[row.owner_id || row.follower_id,row.creator_id,row.updater_id].filter(Boolean)])
    const person = (id) => people.find((p) => String(p.id) === String(id))
    data[resource === 'requirement' ? 'ownerEmployeeNo' : 'followerEmployeeNo'] = person(row.owner_id || row.follower_id)?.employee_no || null
    if (resource === 'work_order') data.problemTypeCode = (await connection.prepare('SELECT code FROM pms_archive WHERE id=?').get(row.problem_type))?.code || null
    data.priority = resource === 'requirement' ? row.priority : undefined
    data.statusLabel = statusLabels[resource][row.status]
    data.allowedStatuses = (resource === 'requirement' ? allowedRequirementStatuses(row.requirement_type,row.status) : allowedWorkOrderStatuses(row.status)).map((value) => ({ value, label: statusLabels[resource][value] }))
    for (const [key,id] of [['creator',row.creator_id],['updater',row.updater_id]]) data[key] = person(id) ? { employeeNo: person(id).employee_no, name: person(id).real_name } : null
    data.createdAt = row.created_at
    data.updatedAt = row.updated_at
    return data
  }
  async function prepareAttachmentUpload(ctx,file) {
    if (!file) throw error('请选择附件')
    const previous = await db.prepare("SELECT request_hash FROM pms_open_request WHERE client_id=? AND idempotency_key=? AND outcome='success'").get(ctx.client.id,ctx.input.idempotencyKey)
    if (previous) return
    ctx.user = await authorize(ctx.client,ctx.resource,ctx.input.operation,ctx.input.operatorEmployeeNo,db)
    const mapping = await db.prepare('SELECT target_id FROM pms_open_record WHERE client_id=? AND resource_type=? AND source_record_id=?').get(ctx.client.id,ctx.resource,ctx.input.sourceRecordId)
    const row = mapping ? await db.prepare(`SELECT id,is_deleted FROM ${tableFor[ctx.resource]} WHERE id=?`).get(mapping.target_id) : null
    if (!row || Number(row.is_deleted) === 1) throw error('来源编号对应的业务记录不存在或已删除',404)
    file.originalname = normalizeOriginalName(file.originalname)
    const validated = validateAttachmentFile(file)
    if (validated.originalname) file.originalname = validated.originalname
    if (validated.mimetype) file.mimetype = validated.mimetype
    await attachments.assertBusinessCanAcceptAttachment(db,ctx.resource,row.id)
    ctx.uploadReceipt = await upload(file,ctx)
  }
  async function perform(ctx, connection, file) {
    const { resource, input, user } = ctx
    const op = input.operation
    const table = tableFor[resource]
    // 与来源锁不同，目标行锁也覆盖页面并发更新。
    const mapping = await connection.prepare('SELECT * FROM pms_open_record WHERE client_id=? AND resource_type=? AND source_record_id=?').get(ctx.client.id,resource,input.sourceRecordId)
    const row = mapping ? await connection.prepare(`SELECT * FROM ${table} WHERE id=? FOR UPDATE`).get(mapping.target_id) : null
    if (op === 'CREATE' && mapping) throw error('来源编号已经存在，请查询后编辑',409)
    if (op !== 'CREATE' && (!row || Number(row.is_deleted) === 1)) {
      if (op === 'DELETE' && row && Number(row.is_deleted) === 1) return { result:'ALREADY_DELETED', targetId:row.id }
      throw error('来源编号对应的业务记录不存在或已删除',404)
    }
    if (op === 'QUERY') return { result:'FOUND', ...await queryData(resource,row,connection) }
    if (op === 'ATTACHMENT_LIST') return { result:'FOUND', attachments:(await attachments.listBusinessAttachments(connection,resource,row.id)).map((a) => ({...a,id:Number(a.id)})) }
    if (op === 'ATTACHMENT_DOWNLOAD') {
      const found = await attachments.findBusinessAttachment(connection,resource,row.id,input.data.attachmentId)
      if (!found) throw error('附件不存在',404)
      return { result:'FOUND', attachment:found }
    }
    if (op === 'ATTACHMENT_UPLOAD') {
      if (!file) throw error('请选择附件')
      file.originalname = normalizeOriginalName(file.originalname)
      const validated = validateAttachmentFile(file)
      if (validated.originalname) file.originalname = validated.originalname
      if (validated.mimetype) file.mimetype = validated.mimetype
      if (!ctx.uploadReceipt) throw error('附件上传回执不存在',500)
      const saved = await attachments.uploadBusinessAttachment(resource,row.id,file,user.id,{ db:connection, uploadAttachmentToOss:async () => ctx.uploadReceipt })
      await connection.writeLog(user.id,'新增附件',labels[resource],row.id,null,null,null,ctx.ip,saved.original_name)
      return { result:'CREATED', targetId:row.id, attachment:{ id:Number(saved.id), name:saved.original_name, size:Number(saved.file_size) } }
    }
    if (op === 'ATTACHMENT_DELETE') {
      const found = await attachments.findBusinessAttachment(connection,resource,row.id,input.data.attachmentId)
      if (!found) throw error('附件不存在',404)
      await attachments.deleteBusinessAttachment(connection,resource,row.id,found.id,user.id)
      await connection.writeLog(user.id,'删除附件',labels[resource],row.id,null,null,null,ctx.ip,found.original_name)
      return { result:'DELETED', targetId:row.id, attachmentId:found.id }
    }
    const ctrl = resource === 'requirement' ? createRequirementController(connection) : createWorkOrderController(connection)
    let body = await convertData(resource,input,connection)
    if (op === 'UPDATE') {
      const same = Object.entries(body).every(([key,v]) => {
        if (key === 'submit_time') return Date.parse(v) === Date.parse(row[key])
        if (key.endsWith('_date')) return String(v ?? '').slice(0,10) === String(row[key] ?? '').slice(0,10)
        return String(v ?? '') === String(row[key] ?? '')
      })
      if (same) return { result:'SKIPPED', targetId:row.id }
      body = { ...row, ...body }
    }
    const action = { CREATE:'create', UPDATE:'update', CHANGE_STATUS:'toggleStatus', DELETE:'remove' }[op]
    const receipt = await invokeController(ctrl[action],ctx,{ params:{ id:row?.id }, body })
    if (receipt.code !== 0) {
      const aliases = Object.fromEntries(Object.entries({ ...maps[resource],...statusMaps[resource] }).map(([a,b]) => [b,a]))
      throw error(receipt.message,receipt.code >= 400 && receipt.code <= 599 ? receipt.code : 500,
        receipt.fieldErrors ? Object.fromEntries(Object.entries(receipt.fieldErrors).map(([k,v]) => [aliases[k] || k,v])) : undefined)
    }
    const id = row?.id || receipt.data?.id
    if (op === 'DELETE' && resource === 'work_order') await connection.prepare('UPDATE pms_work_order SET updated_at=NOW() WHERE id=?').run(id)
    if (op === 'CREATE') await connection.prepare('INSERT INTO pms_open_record(client_id,resource_type,source_record_id,target_id) VALUES(?,?,?,?)').run(ctx.client.id,resource,input.sourceRecordId,id)
    return { result:{ CREATE:'CREATED', UPDATE:'UPDATED', CHANGE_STATUS:'STATUS_CHANGED', DELETE:'DELETED' }[op],targetId:id }
  }
  async function operate(token,resource,raw,{ file,ip,requestId } = {}) {
    const ctx = { requestId:requestId || crypto.randomUUID(), resource, input:raw, ip }
    try {
      ctx.client = await authenticate(token)
      ctx.input = parseInput(resource,raw)
      ctx.digest = requestHash(resource,ctx.input,file)
      if (ctx.input.operation === 'ATTACHMENT_UPLOAD') await prepareAttachmentUpload(ctx,file)
      const result = await db.transaction(async (tx) => {
        await tx.query("SET LOCAL lock_timeout = '10s'")
        await tx.query("SET LOCAL statement_timeout = '60s'")
        ctx.client = await tx.prepare('SELECT * FROM pms_open_client WHERE id=? FOR SHARE').get(ctx.client.id)
        if (Number(ctx.client.enabled) !== 1 || ctx.client.token_hash !== hash(token) || (ctx.client.expires_at && Date.parse(ctx.client.expires_at) <= Date.now())) throw error('凭证已停用或失效',401)
        ctx.user = await authorize(ctx.client,resource,ctx.input.operation,ctx.input.operatorEmployeeNo,tx)
        const write = !readOperations.has(ctx.input.operation)
        if (write) {
          await tx.query('SELECT pg_advisory_xact_lock(hashtextextended(?,0))',[`open-key:${ctx.client.id}:${ctx.input.idempotencyKey}`])
          const previous = await tx.prepare("SELECT request_hash,result_json FROM pms_open_request WHERE client_id=? AND idempotency_key=? AND outcome='success'").get(ctx.client.id,ctx.input.idempotencyKey)
          if (previous) {
            if (previous.request_hash !== ctx.digest) throw error('该请求号已用于不同的请求内容',409)
            await log(tx,ctx,'replayed',200,previous.result_json)
            return { ...previous.result_json, replayed:true }
          }
        }
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended(?,0))',[`open-source:${ctx.client.id}:${resource}:${ctx.input.sourceRecordId}`])
        const data = { ...await perform(ctx,tx,file),operation:ctx.input.operation,sourceRecordId:ctx.input.sourceRecordId }
        if (data.targetId !== undefined) data.targetId = Number(data.targetId)
        await log(tx,ctx,'success',200,write ? data : { result:data.result })
        return data
      })
      return { code:0,message:'success',data:result,requestId:ctx.requestId }
    } catch (e) {
      const status = e.statusCode || (e.code === '23505' ? 409 : 500)
      if (status === 500) console.error('开放接口处理失败',ctx.requestId,e.code || e.name)
      const failure = { code:status,message:status === 500 ? '处理失败，请联系管理员并提供 requestId' : e.code === '23505' ? '数据已存在或发生并发冲突' : e.message,data:null,requestId:ctx.requestId }
      if (e.fieldErrors) failure.fieldErrors = e.fieldErrors
      if (ctx.client && tableFor[resource]) await log(db,ctx,'failed',status,{ code:status,message:failure.message,...(failure.fieldErrors ? {fieldErrors:failure.fieldErrors} : {}) }).catch(() => console.error('开放接口失败日志写入失败',ctx.requestId))
      return failure
    }
  }
  async function systemQuery(token,operation,employeeNo,types = [],requestId) {
    const ctx = { requestId:requestId || crypto.randomUUID(),resource:'system',input:{operation} }
    try {
      ctx.client = await authenticate(token)
      let data
      if (operation === 'HEALTH') { await db.prepare('SELECT 1 AS ok').get(); data = { status:'healthy' } }
      else {
        ctx.user = await authorize(ctx.client,'system',operation,employeeNo,db)
        if (!types.length || types.some((t) => !['products','users','workOrderProblemTypes'].includes(t))) throw error('types 不正确')
        const menus = await getAllowedMenuPaths(ctx.user.id,db)
        if (!menus.has('/requirements') && !menus.has('/work-orders')) throw error('操作人没有业务访问权限',403)
        data = {}
        if (types.includes('products')) data.products = await db.prepare('SELECT name FROM pms_product WHERE status=1 AND is_deleted=0 ORDER BY id').all()
        if (types.includes('users')) data.users = await db.prepare('SELECT employee_no "employeeNo",real_name name FROM pms_user WHERE status=1 AND is_deleted=0 ORDER BY id').all()
        if (types.includes('workOrderProblemTypes')) {
          if (!menus.has('/work-orders')) throw error('操作人没有工单访问权限',403)
          data.workOrderProblemTypes = await db.prepare("SELECT a.code,a.name FROM pms_archive a JOIN pms_archive_type t ON t.id=a.archive_type_id WHERE t.code_prefix='PT' AND a.status=1 AND a.is_deleted=0 AND t.status=1 AND t.is_deleted=0 ORDER BY a.id").all()
        }
      }
      await log(db,ctx,'success',200,{result:'FOUND'})
      return {code:0,message:operation === 'HEALTH' ? '连接成功' : 'success',data,requestId:ctx.requestId}
    } catch (e) {
      const code = e.statusCode || 500
      if (ctx.client) await log(db,ctx,'failed',code,{code,message:code === 500 ? '查询失败' : e.message}).catch(() => console.error('开放接口查询日志写入失败',ctx.requestId))
      return {code,message:code === 500 ? '查询失败' : e.message,data:null,requestId:ctx.requestId}
    }
  }
  async function recordDownloadFailure(requestId,{status = 502,message = '附件下载失败'} = {}) {
    // 下载鉴权通过并不代表传输成功；存储或流传输失败时完成同一请求的最终回执。
    await db.prepare("UPDATE pms_open_request SET outcome='failed',http_status=?,result_json=? WHERE request_id=? AND operation='ATTACHMENT_DOWNLOAD' AND outcome='success'")
      .run(status,JSON.stringify({code:status,message}),requestId)
  }
  return { authenticate,operate,systemQuery,recordDownloadFailure }
}
module.exports = { createOpenApiService }
