const { formatHistoryChanges, groupOperationLogs } = require('../utils/operationHistory')

const FIELD_ORDER = [
  'stage_id',
  'name',
  'owner_id',
  'collaborator_ids',
  'requires_delivery_file',
  'remark',
  'status',
  'actual_end_date',
  'pause_reason',
  'delivery_files',
  'current_due_date',
  'adjustment_reason',
  'sort_order',
  'description',
]

const FIELD_LABELS = {
  stage_id: '所属阶段',
  name: '名称',
  owner_id: '负责人',
  collaborator_ids: '协作人',
  requires_delivery_file: '需要交付文件',
  remark: '备注',
  status: '状态',
  actual_end_date: '实际完成时间',
  pause_reason: '暂停原因',
  delivery_files: '交付文件',
  current_due_date: '计划完成时间',
  adjustment_reason: '调整原因',
  sort_order: '所在位置',
  description: '阶段描述',
}

const HIDE_DETAILS_ACTIONS = new Set(['新增阶段', '删除阶段', '新增关键事项', '删除关键事项', '套用阶段模板'])
const DATE_FIELDS = new Set(['actual_end_date', 'current_due_date'])
const STATUS_LOOKUP = new Map([['0', '未开始'], ['1', '进行中'], ['2', '已完成'], ['3', '已暂停']])

function buildProjectStagePlanHistory(logs, { stageLookup = new Map(), userLookup = new Map() } = {}) {
  const changedLogs = logs.filter((log) => !log.field_name || String(log.old_value ?? '') !== String(log.new_value ?? ''))
  return groupOperationLogs(changedLogs, FIELD_ORDER).map((group) => ({
    id: group.id,
    action: `${group.action} · ${group.target_name || '-'}`,
    created_at: group.created_at,
    operator: group.operator,
    changes: HIDE_DETAILS_ACTIONS.has(group.action)
      ? []
      : formatHistoryChanges(group.changes, {
        fieldLabels: FIELD_LABELS,
        dateFields: DATE_FIELDS,
        valueLookups: {
          stage_id: stageLookup,
          owner_id: userLookup,
          status: STATUS_LOOKUP,
        },
        valueResolver: (field, value) => {
          if (field === 'collaborator_ids') {
            if (!value) return ''
            return String(value).split(',').filter(Boolean).map((id) => userLookup.get(String(id)) || '-').join('、')
          }
          if (field === 'requires_delivery_file') return String(value) === '1' ? '是' : '否'
          return undefined
        },
      }),
  }))
}

function buildPlanItemStatusHistoryChanges(item, target, actualEndDate, pauseReason, fileNames = []) {
  const changes = [
    { field: 'status', oldVal: item.status, newVal: target },
    { field: 'actual_end_date', oldVal: item.actual_end_date, newVal: actualEndDate },
    { field: 'pause_reason', oldVal: item.pause_reason, newVal: pauseReason },
  ]
  if (fileNames.length) {
    changes.push({ field: 'delivery_files', oldVal: null, newVal: fileNames.join('、') })
  }
  return changes
}

function resolveMovedPlanRow(rows, orderedIds, movedId) {
  const normalizedMovedId = Number(movedId)
  const orderedRows = [...rows].sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || Number(a.id) - Number(b.id))
  const oldIndex = orderedRows.findIndex((row) => Number(row.id) === normalizedMovedId)
  const newIndex = orderedIds.map(Number).indexOf(normalizedMovedId)
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return null
  const row = orderedRows[oldIndex]
  return {
    id: normalizedMovedId,
    name: row.name,
    oldPosition: oldIndex + 1,
    newPosition: newIndex + 1,
  }
}

function appendLegacyAdjustmentReasons(logs, adjustments) {
  const enriched = [...logs]
  for (const log of logs) {
    if (log.action !== '调整计划' || log.field_name !== 'current_due_date') continue
    const hasReason = logs.some((candidate) => candidate.action === log.action
      && candidate.target_id === log.target_id
      && candidate.operation_id
      && candidate.operation_id === log.operation_id
      && candidate.field_name === 'adjustment_reason')
    if (hasReason) continue
    const logTime = new Date(log.created_at).getTime()
    const match = adjustments
      .filter((adjustment) => Number(adjustment.plan_item_id) === Number(log.target_id)
        && String(adjustment.new_due_date).slice(0, 10) === String(log.new_value).slice(0, 10))
      .map((adjustment) => ({ adjustment, distance: Math.abs(new Date(adjustment.created_at).getTime() - logTime) }))
      .filter(({ distance }) => Number.isFinite(distance) && distance <= 5 * 60 * 1000)
      .sort((a, b) => a.distance - b.distance)[0]?.adjustment
    if (!match) continue
    enriched.push({
      ...log,
      field_name: 'adjustment_reason',
      old_value: null,
      new_value: match.reason,
    })
  }
  return enriched
}

module.exports = {
  appendLegacyAdjustmentReasons,
  buildPlanItemStatusHistoryChanges,
  buildProjectStagePlanHistory,
  resolveMovedPlanRow,
}
