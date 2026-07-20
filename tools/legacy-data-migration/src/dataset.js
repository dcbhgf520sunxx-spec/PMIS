const {
  buildLegacyTaskTypeCodeMap,
  parseMemberIds,
  resolveTargetTaskTypeId,
  shouldMigrateOperationLog,
  toShanghaiTimestamp,
} = require('./transform')

function mapTimestamps(row, fields = ['created_at', 'updated_at']) {
  const result = { ...row }
  for (const field of fields) {
    if (Object.hasOwn(result, field)) result[field] = toShanghaiTimestamp(result[field])
  }
  return result
}

function transformLegacyDataset(source, targetTaskTypeIdByCode) {
  const legacyTaskTypeCodeById = buildLegacyTaskTypeCodeMap(source.archives || [])
  const users = (source.users || []).map((row) => mapTimestamps(row))
  const userCreatedAtById = new Map((source.users || []).map((row) => [Number(row.id), row.created_at]))
  const userRoles = (source.userRoles || []).map((row) => mapTimestamps({
    ...row,
    created_at: row.created_at || userCreatedAtById.get(Number(row.user_id)),
  }, ['created_at']))
  const projects = (source.projects || []).map((row) => mapTimestamps(row))
  const projectMembers = projects.flatMap((project) =>
    parseMemberIds(project.member_ids).map((userId) => ({
      project_id: Number(project.id),
      user_id: userId,
    })))
  const tasks = (source.tasks || []).map((row) => ({
    ...mapTimestamps(row),
    task_type: resolveTargetTaskTypeId(
      row.task_type,
      legacyTaskTypeCodeById,
      targetTaskTypeIdByCode
    ),
  }))
  const operationLogs = (source.operationLogs || [])
    .filter(shouldMigrateOperationLog)
    .map((row) => mapTimestamps(row, ['created_at']))

  return {
    ...source,
    archiveTypes: (source.archiveTypes || []).map((row) => mapTimestamps(row)),
    archives: (source.archives || []).map((row) => mapTimestamps(row)),
    users,
    roles: (source.roles || []).map((row) => mapTimestamps(row)),
    userRoles,
    products: (source.products || []).map((row) => mapTimestamps(row)),
    projects,
    requirements: (source.requirements || []).map((row) => mapTimestamps(row)),
    tasks,
    projectMembers,
    operationLogs,
  }
}

module.exports = { mapTimestamps, transformLegacyDataset }
