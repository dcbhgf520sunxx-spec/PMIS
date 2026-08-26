const { DEFAULT_PRIORITY } = require('./priorityRules')

const INITIAL_SYNC_START = '2026-08-24'
const SYNC_SECTION_START = '<!-- i8-sync:start -->'
const SYNC_SECTION_END = '<!-- i8-sync:end -->'

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function buildRequirementTitle(description) {
  const text = cleanText(description)
  if (!text) throw new Error('问题描述为空，无法生成需求标题')
  return text.length <= 100 ? text : `${text.slice(0, 100)}……`
}

function optionalText(value) {
  return String(value ?? '').trim()
}

function escapeHtml(value) {
  return optionalText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function richTextValue(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>')
}

function dateOnly(value) {
  const text = optionalText(value)
  if (!text) return null
  const matched = text.match(/^\d{4}-\d{2}-\d{2}/)
  if (!matched) throw new Error(`日期格式不正确“${text}”`)
  return matched[0]
}

function buildSyncedSection(record, targetType) {
  const fields = targetType === 'requirement'
    ? [
      ['问题描述', record.问题描述],
      ['模块', record.模块],
      ['单据编号', record.单据编码],
    ]
    : [
      ['问题描述', record.问题描述],
      ['模块', record.模块],
      ['负责人', record.负责人],
      ['单据编号', record.单据编码],
    ]
  return fields
    .filter(([, value]) => optionalText(value))
    .map(([label, value]) => `<p>${label}：${richTextValue(value)}</p>`)
    .join('')
}

function mergeSyncedSection(existingValue, syncedSection) {
  const existing = optionalText(existingValue)
  const block = `${SYNC_SECTION_START}\n${optionalText(syncedSection)}\n${SYNC_SECTION_END}`
  const startIndex = existing.indexOf(SYNC_SECTION_START)
  const endIndex = existing.indexOf(SYNC_SECTION_END)
  if (startIndex >= 0 && endIndex >= startIndex) {
    return `${existing.slice(0, startIndex)}${block}${existing.slice(endIndex + SYNC_SECTION_END.length)}`
  }
  return existing ? `${existing}\n\n${block}` : block
}

function classifyItopsRecord(category) {
  const value = cleanText(category)
  if (value === '需求问题') return { targetType: 'requirement', requirementType: 4 }
  if (value === '操作问题') return { targetType: 'work_order', problemTypeName: '日常操作' }
  if (value === '系统问题') return { targetType: 'work_order', problemTypeName: '系统优化' }
  throw new Error(`不支持的问题类别“${value || '空'}”`)
}

function mapPriority(value) {
  const text = cleanText(value)
  if (text === '重要') return { priority: 2, warning: null }
  if (text === '普通') return { priority: 1, warning: null }
  return {
    priority: 1,
    warning: text ? `未知紧急程度“${text}”，已按中优先级处理` : '紧急程度为空，已按中优先级处理',
  }
}

function mapItopsRecord(record) {
  const externalCode = cleanText(record?.单据编码)
  if (!externalCode) throw new Error('单据编码为空')
  const category = classifyItopsRecord(record?.问题类别)
  const description = optionalText(record?.问题描述)
  if (!description) throw new Error(`单据“${externalCode}”问题描述为空`)
  const priority = mapPriority(record?.紧急程度)
  const completionDate = dateOnly(record?.完成时间)
  const common = {
    externalCode,
    sourceCategory: cleanText(record?.问题类别),
    sourceOwnerName: cleanText(record?.负责人),
    priority: priority.priority,
    warning: priority.warning,
    submitterName: cleanText(record?.提交人) || 'i8',
    submitterDept: cleanText(record?.提交组织) || 'i8',
    submitDate: dateOnly(record?.单据日期),
    expectedEndDate: dateOnly(record?.预计解决时间),
    actualEndDate: completionDate,
    externalUpdatedAt: optionalText(record?.更新时间) || null,
    syncedSection: buildSyncedSection(record, category.targetType),
    solution: optionalText(record?.解决方案) || null,
    sourceRecord: record,
  }
  if (!common.submitDate) throw new Error(`单据“${externalCode}”单据日期为空`)
  if (category.targetType === 'requirement') {
    return {
      ...common,
      ...category,
      priority: DEFAULT_PRIORITY,
      warning: null,
      title: buildRequirementTitle(description),
      status: completionDate ? 33 : 31,
      completionStatus: completionDate ? (common.solution || '已完成（i8同步）') : null,
    }
  }
  return {
    ...common,
    ...category,
    status: completionDate ? 2 : 1,
    problemDescription: description,
  }
}

function dateText(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('同步时间格式不正确')
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

function previousDate(value) {
  const day = new Date(`${String(value).slice(0, 10)}T00:00:00+08:00`)
  day.setUTCDate(day.getUTCDate() - 1)
  return dateText(day)
}

function resolveInitialSyncStart(value = INITIAL_SYNC_START) {
  return dateText(value)
}

function resolveSyncWindow({ now = new Date(), lastSuccessAt, initialSyncDate } = {}) {
  return {
    start: lastSuccessAt ? previousDate(lastSuccessAt) : resolveInitialSyncStart(initialSyncDate),
    end: dateText(now),
  }
}

module.exports = {
  INITIAL_SYNC_START,
  buildRequirementTitle,
  classifyItopsRecord,
  cleanText,
  mapPriority,
  mapItopsRecord,
  mergeSyncedSection,
  resolveInitialSyncStart,
  resolveSyncWindow,
}
