const TARGETS = {
  project: { column: 'project_id', module: '项目', table: 'pms_project' },
  requirement: { column: 'requirement_id', module: '需求', table: 'pms_requirement' },
  task: { column: 'task_id', module: '任务', table: 'pms_task' },
}

function normalizeFollowUpContent(value) {
  const content = typeof value === 'string' ? value.trim() : ''
  if (!content) throw new Error('请输入跟进内容')
  if ([...content].length > 200) throw new Error('跟进内容不能超过200字')
  return content
}

function resolveFollowUpTarget(type, rawId) {
  const target = TARGETS[type]
  if (!target) throw new Error('跟进对象类型不正确')
  const id = Number(rawId)
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('跟进对象不存在')
  return { ...target, id }
}

function buildFollowUpHistoryLog(target, operation, oldValue, newValue) {
  const actions = {
    create: '新增跟进记录',
    update: '编辑跟进记录',
    remove: '删除跟进记录',
  }
  const action = actions[operation]
  if (!action) throw new Error('跟进操作类型不正确')
  return {
    action,
    module: target.module,
    targetId: target.id,
    fieldName: 'follow_up_content',
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
  }
}

function normalizeFollowUpHistoryAction(action) {
  return {
    新增跟进: '新增跟进记录',
    编辑跟进: '编辑跟进记录',
    删除跟进: '删除跟进记录',
  }[action] || action
}

module.exports = { buildFollowUpHistoryLog, normalizeFollowUpContent, normalizeFollowUpHistoryAction, resolveFollowUpTarget }
