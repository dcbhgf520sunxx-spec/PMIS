const crypto = require('node:crypto')
const { z } = require('zod')
const { sanitizeRichText } = require('./richTextSanitizer')
const { BUSINESS_FIELD_LIMITS: LIMITS } = require('./businessFieldRules')

const text = (max) => z.string().trim().min(1).max(max)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}, '日期不存在')
const rich = z.string().transform(sanitizeRichText)
const priority = z.number().int().min(0).max(2)
const fields = {
  title: text(LIMITS.requirementTitle).refine((s) => !/[\r\n]/.test(s), '标题不能换行'),
  description: rich.nullable(), requirementType: z.number().int().min(1).max(4),
  productName: text(LIMITS.productName), ownerEmployeeNo: text(LIMITS.employeeNo), followerEmployeeNo: text(LIMITS.employeeNo),
  submitterName: text(LIMITS.submitterName), submitterDept: text(LIMITS.submitterDept), submitDate: date,
  startDate: date.nullable(), expectedEndDate: date.nullable(),
  problemDescription: rich.refine((s) => !!s.trim(), '问题描述不能为空'),
  problemTypeCode: text(LIMITS.problemTypeCode), urgency: priority, expectedResolveDate: date,
  submitTime: date,
  status: z.number().int(),
  actualEndDate: date, completionStatus: text(LIMITS.requirementCompletionStatus), pauseDate: date,
  resolveDate: date, resultDescription: rich.refine((s) => !!s.trim()),
  suspendDate: date, activationReason: text(LIMITS.activationReason), attachmentId: z.number().int().positive(),
}
const maps = {
  requirement: { title: 'title', description: 'description', requirementType: 'requirement_type', productName: 'product_id', ownerEmployeeNo: 'owner_id', submitterName: 'submitter_name', submitterDept: 'submitter_dept', submitDate: 'submit_date', startDate: 'start_date', expectedEndDate: 'expected_end_date' },
  work_order: { problemDescription: 'problem_desc', productName: 'product_id', problemTypeCode: 'problem_type', followerEmployeeNo: 'follower_id', urgency: 'urgency', expectedResolveDate: 'expected_resolve_date', submitterName: 'submitter_name', submitterDept: 'submitter_dept', submitTime: 'submit_time' },
}
const statusMaps = {
  requirement: { status: 'status', actualEndDate: 'actual_end_date', completionStatus: 'completion_status', pauseDate: 'pause_date' },
  work_order: { status: 'status', resolveDate: 'resolve_date', resultDescription: 'result_desc', suspendDate: 'suspend_date', activationReason: 'activation_reason' },
}
const required = {
  requirement: ['title', 'requirementType', 'productName', 'ownerEmployeeNo', 'submitterName', 'submitDate'],
  work_order: ['problemDescription', 'productName', 'problemTypeCode', 'followerEmployeeNo', 'urgency', 'expectedResolveDate', 'submitterName', 'submitterDept', 'submitTime'],
}
const operations = ['QUERY', 'CREATE', 'UPDATE', 'CHANGE_STATUS', 'DELETE', 'ATTACHMENT_LIST', 'ATTACHMENT_UPLOAD', 'ATTACHMENT_DELETE', 'ATTACHMENT_DOWNLOAD']
const readOperations = new Set(['QUERY', 'ATTACHMENT_LIST', 'ATTACHMENT_DOWNLOAD', 'HEALTH', 'REFERENCE_DATA'])
function error(message, statusCode = 400, fieldErrors) { return Object.assign(new Error(message), { statusCode, fieldErrors }) }
function parseInput(resource, input) {
  if (!maps[resource]) throw error('业务类型不存在', 404)
  const base = z.strictObject({ operation: z.enum(operations), sourceRecordId: text(100), operatorEmployeeNo: text(50), idempotencyKey: text(100).optional(), data: z.record(z.string(), z.unknown()).optional() }).safeParse(input)
  if (!base.success) {
    const details = z.flattenError(base.error)
    throw error('请求字段不正确',400,{...details.fieldErrors,...(details.formErrors.length ? {_request:details.formErrors} : {})})
  }
  const b = base.data
  if (!readOperations.has(b.operation) && !b.idempotencyKey) throw error('写操作必须提供 idempotencyKey')
  if (readOperations.has(b.operation) && b.idempotencyKey) throw error('查询不接受 idempotencyKey')
  const selected = b.operation === 'CHANGE_STATUS' ? statusMaps[resource]
    : ['CREATE', 'UPDATE'].includes(b.operation) ? maps[resource]
      : ['ATTACHMENT_DELETE', 'ATTACHMENT_DOWNLOAD'].includes(b.operation) ? { attachmentId: 'attachmentId' } : {}
  const shape = Object.fromEntries(Object.keys(selected).map((key) => {
    let rule = fields[key]
    if (resource === 'requirement' && key === 'submitterDept') rule = z.string().trim().max(100).nullable()
    const must = b.operation === 'CREATE' ? required[resource].includes(key) : ['status', 'attachmentId'].includes(key)
    return [key, must ? rule : rule.optional()]
  }))
  const parsed = z.strictObject(shape).safeParse(b.data || {})
  if (!parsed.success) {
    const details = z.flattenError(parsed.error)
    throw error('业务字段不正确',400,{...details.fieldErrors,...(details.formErrors.length ? {data:details.formErrors} : {})})
  }
  if (b.operation === 'CHANGE_STATUS') {
    const extra = resource === 'requirement'
      ? ({33:['actualEndDate','completionStatus'],34:['actualEndDate','completionStatus'],35:['pauseDate']}[parsed.data.status] || [])
      : ({2:['resolveDate','resultDescription'],4:['suspendDate'],5:['activationReason']}[parsed.data.status] || [])
    for (const key of extra) if (parsed.data[key] === undefined) throw error('请补充状态变更字段',400,{[key]:['该目标状态必填']})
    for (const key of Object.keys(parsed.data)) if (key !== 'status' && !extra.includes(key)) throw error('该目标状态不接受此字段',400,{[key]:['请删除不适用的字段']})
  }
  if (b.operation === 'UPDATE' && !Object.keys(parsed.data).length) throw error('至少提供一个修改字段')
  return { ...b, data: parsed.data }
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]))
  return value
}
const hash = (v) => crypto.createHash('sha256').update(v).digest('hex')
const requestHash = (resource, input, file) => hash(JSON.stringify(canonical({ resource, ...input, file: file ? { name: file.originalname, mime: file.mimetype, sha256: hash(file.buffer) } : null })))
module.exports = { maps, statusMaps, required, readOperations, operations, parseInput, requestHash, hash, error }
