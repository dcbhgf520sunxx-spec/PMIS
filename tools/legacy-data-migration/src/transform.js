const BUSINESS_ROLE_MENU_CODES = Object.freeze([
  'home',
  'product',
  'project',
  'requirement',
  'task',
  'bug',
  'work_order',
])

const CONFIRMED_LEGACY_COUNTS = Object.freeze({
  pms_user: 20,
  pms_role: 2,
  pms_user_role: 21,
  pms_archive_type: 1,
  pms_archive: 11,
  pms_product: 5,
  pms_project: 10,
  pms_requirement: 37,
  pms_task: 31,
  pms_operation_log: 178,
  pms_milestone: 7,
  pms_mcp_audit_log: 643,
  pms_bug: 0,
  pms_work_order: 0,
})

function parseMemberIds(value) {
  if (value == null || String(value).trim() === '') return []
  const seen = new Set()
  const ids = []
  for (const item of String(value).split(',')) {
    const text = item.trim()
    if (!/^\d+$/.test(text) || Number(text) <= 0) {
      throw new Error(`项目成员 ID 非法：${text || '<空>'}`)
    }
    const id = Number(text)
    if (!seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }
  return ids
}

function toShanghaiTimestamp(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(value).replace(' ', 'T')
    return `${parts}+08:00`
  }
  const text = String(value).trim()
  const match = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/)
  if (!match) throw new Error(`时间格式非法：${text}`)
  return `${match[1]}T${match[2]}+08:00`
}

function shouldMigrateOperationLog(row) {
  return row?.module !== '里程碑'
}

function buildLegacyTaskTypeCodeMap(archives) {
  return new Map(archives
    .filter((row) => row.archive_type_code === 'task_type')
    .map((row) => [Number(row.id), row.code]))
}

function resolveTargetTaskTypeId(legacyId, legacyCodeById, targetIdByCode) {
  const code = legacyCodeById.get(Number(legacyId))
  const targetId = code ? targetIdByCode.get(code) : null
  if (!targetId) throw new Error(`任务类型映射缺失：旧 ID ${legacyId}${code ? `，代码 ${code}` : ''}`)
  return Number(targetId)
}

function assertLegacySnapshot(actualCounts) {
  for (const [table, expected] of Object.entries(CONFIRMED_LEGACY_COUNTS)) {
    const actual = Number(actualCounts[table])
    if (actual !== expected) {
      throw new Error(`源库数量与确认快照不一致：${table}，预期 ${expected}，实际 ${actual}`)
    }
  }
}

module.exports = {
  BUSINESS_ROLE_MENU_CODES,
  CONFIRMED_LEGACY_COUNTS,
  assertLegacySnapshot,
  buildLegacyTaskTypeCodeMap,
  parseMemberIds,
  resolveTargetTaskTypeId,
  shouldMigrateOperationLog,
  toShanghaiTimestamp,
}
